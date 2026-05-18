#!/usr/bin/env bash
# Routiq Deployment Script
# Usage: ./deploy/deploy.sh [environment]
# Environments: staging, production

set -euo pipefail

# Configuration
ENVIRONMENT="${1:-staging}"
REGISTRY="${DOCKER_REGISTRY:-ghcr.io/routiq}"
VERSION="${VERSION:-$(git rev-parse --short HEAD 2>/dev/null || echo 'latest')}"
COMPOSE_FILE="docker-compose.yml"
COMPOSE_PROD_FILE="docker-compose.prod.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    log_error "Invalid environment: $ENVIRONMENT. Must be 'staging' or 'production'."
    exit 1
fi

log_info "Deploying Routiq to ${ENVIRONMENT} (version: ${VERSION})"

# Step 1: Run pre-deployment checks
log_info "Running pre-deployment checks..."

if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed or not in PATH"
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    log_error "Docker Compose is not installed or not in PATH"
    exit 1
fi

# Check .env file exists
if [[ ! -f ".env.${ENVIRONMENT}" && ! -f ".env" ]]; then
    log_warn "No .env.${ENVIRONMENT} or .env file found. Using environment variables."
fi

# Step 2: Build images
log_info "Building Docker images..."

docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_PROD_FILE" build \
    --build-arg VERSION="$VERSION" \
    --build-arg ENVIRONMENT="$ENVIRONMENT"

# Step 3: Tag and push images to registry
log_info "Tagging images with version: ${VERSION}"

API_IMAGE="${REGISTRY}/routiq-api:${VERSION}"
FRONTEND_IMAGE="${REGISTRY}/routiq-frontend:${VERSION}"

docker tag routiq-api:latest "$API_IMAGE"
docker tag routiq-frontend:latest "$FRONTEND_IMAGE"

# Also tag as latest for the environment
docker tag routiq-api:latest "${REGISTRY}/routiq-api:${ENVIRONMENT}"
docker tag routiq-frontend:latest "${REGISTRY}/routiq-frontend:${ENVIRONMENT}"

log_info "Pushing images to registry..."
docker push "$API_IMAGE"
docker push "$FRONTEND_IMAGE"
docker push "${REGISTRY}/routiq-api:${ENVIRONMENT}"
docker push "${REGISTRY}/routiq-frontend:${ENVIRONMENT}"

# Step 4: Deploy with Docker Compose
log_info "Deploying services..."

# Load environment-specific env file if it exists
ENV_FILE=""
if [[ -f ".env.${ENVIRONMENT}" ]]; then
    ENV_FILE="--env-file .env.${ENVIRONMENT}"
fi

docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_PROD_FILE" $ENV_FILE up -d --remove-orphans

# Step 5: Run database migrations
log_info "Running database migrations..."

docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_PROD_FILE" exec -T api \
    python -m alembic upgrade head || {
        log_warn "Migration failed or alembic not configured. Skipping."
    }

# Step 6: Health check
log_info "Running health checks..."

MAX_RETRIES=30
RETRY_INTERVAL=2
HEALTH_URL="http://localhost:80/health"

for i in $(seq 1 $MAX_RETRIES); do
    if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
        log_info "Health check passed!"
        break
    fi

    if [[ $i -eq $MAX_RETRIES ]]; then
        log_error "Health check failed after ${MAX_RETRIES} attempts"
        log_error "Checking container logs..."
        docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_PROD_FILE" logs --tail=50 api
        exit 1
    fi

    echo -n "."
    sleep $RETRY_INTERVAL
done

# Step 7: Post-deployment summary
log_info "Deployment complete!"
echo ""
echo "========================================="
echo " Routiq Deployment Summary"
echo "========================================="
echo " Environment: ${ENVIRONMENT}"
echo " Version:     ${VERSION}"
echo " API Image:   ${API_IMAGE}"
echo " Frontend:    ${FRONTEND_IMAGE}"
echo " Health:      ${HEALTH_URL}"
echo "========================================="
echo ""

# Show running containers
docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_PROD_FILE" ps
