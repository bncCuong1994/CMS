import { useAuthStore } from '@/features/auth/auth-store';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

/** Đổi refresh token lấy access token mới; các request song song dùng chung một lần gọi. */
function refreshTokens(): Promise<boolean> {
  refreshing ??= (async () => {
    const { refreshToken, setTokens, clear } = useAuthStore.getState();
    if (!refreshToken) return false;
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clear();
      return false;
    }
    setTokens(await res.json());
    return true;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}, retry = true): Promise<T> {
  const { json, headers, ...rest } = init;
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await refreshTokens()) return api<T>(path, init, false);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new ApiError(res.status, message ?? res.statusText);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}
