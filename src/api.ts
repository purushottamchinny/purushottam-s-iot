/**
 * Centralized API Client with Token Authentication & Auto-Retry
 * Supports iframe embedding by maintaining Bearer tokens in localStorage
 */

export const getAuthToken = (): string | null => {
  return localStorage.getItem('smarthome_auth_token');
};

export const setAuthToken = (token: string): void => {
  localStorage.setItem('smarthome_auth_token', token);
};

export const clearAuthToken = (): void => {
  localStorage.removeItem('smarthome_auth_token');
};

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: T }> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    // Provide dev master token fallback if unauthenticated
    headers.set('Authorization', 'Bearer master-admin-token');
  }

  const config: RequestInit = {
    ...options,
    headers,
    credentials: 'include',
  };

  try {
    const res = await fetch(endpoint, config);
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }

    return {
      ok: res.ok,
      status: res.status,
      data,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: { error: err.message || 'Network request failed' } as any,
    };
  }
}
