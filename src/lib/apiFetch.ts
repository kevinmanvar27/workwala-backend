/**
 * apiFetch — drop-in wrapper around `fetch` that automatically injects the
 * `x-csrf-token` header for state-mutating requests (POST / PATCH / PUT / DELETE).
 *
 * The CSRF token is stored in the `csrf_token` cookie (httpOnly: false) which
 * is set by the login route and refreshed on every token refresh.
 */

function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

const CSRF_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();

  if (CSRF_METHODS.has(method)) {
    const csrfToken = getCsrfToken();
    const existingHeaders = new Headers(init.headers);
    if (csrfToken) {
      existingHeaders.set('x-csrf-token', csrfToken);
    }
    init = { ...init, headers: existingHeaders };
  }

  return fetch(input, init);
}
