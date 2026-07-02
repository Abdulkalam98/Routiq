import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('routiq_token');
}

export function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('routiq_token');
  }
}

function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

function isExpired(decoded) {
  if (!decoded?.exp) return true;
  return decoded.exp * 1000 < Date.now();
}

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    const decoded = decodeToken(token);
    if (!decoded || isExpired(decoded)) {
      logout();
      router.replace('/login');
      return;
    }
    setUser({ customer_id: decoded.sub, email: decoded.email });
  }, [router]);

  return user;
}
