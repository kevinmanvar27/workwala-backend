/**
 * apiFetch — drop-in wrapper around `fetch` that:
 *  1. Automatically injects the `x-csrf-token` header for state-mutating
 *     requests (POST / PATCH / PUT / DELETE).
 *  2. On a 401 response, attempts a silent token refresh via
 *     POST /api/auth/refresh and retries the original request once.
 *
 * The CSRF token is stored in the `csrf_token` cookie (httpOnly: false) which
 * is set by the login route and refreshed on every token refresh.
 */

function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]).trim() : '';
}

const CSRF_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

function buildInit(init: RequestInit): RequestInit {
  const method = (init.method ?? 'GET').toUpperCase();
  if (!CSRF_METHODS.has(method)) return init;

  const csrfToken = getCsrfToken();
  const headers = new Headers(init.headers);
  if (csrfToken) headers.set('x-csrf-token', csrfToken);
  return { ...init, headers };
}

let isRefreshing = false;
let refreshQueue: Array<(ok: boolean) => void> = [];

async function attemptRefresh(): Promise<boolean> {
  // If a refresh is already in-flight, queue up and wait for it
  if (isRefreshing) {
    return new Promise((resolve) => refreshQueue.push(resolve));
  }

  isRefreshing = true;
  try {
    const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    const ok = res.ok;
    refreshQueue.forEach((cb) => cb(ok));
    refreshQueue = [];
    return ok;
  } catch {
    refreshQueue.forEach((cb) => cb(false));
    refreshQueue = [];
    return false;
  } finally {
    isRefreshing = false;
  }
}

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const res = await fetch(input, buildInit(init));

  // On 401, try a silent token refresh and retry once with fresh CSRF token
  if (res.status === 401) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      return fetch(input, buildInit(init));
    }
    // Refresh failed — redirect to login
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  return res;
}
