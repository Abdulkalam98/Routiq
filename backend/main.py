from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config import get_settings
from routers import chat, models, keys, billing


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="Route smarter. Build faster. One API. Every AI Model. Pay in ₹.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/v1")
app.include_router(models.router, prefix="/v1")
app.include_router(keys.router, prefix="/v1")
app.include_router(billing.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "routiq"}
