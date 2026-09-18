import { env } from "@/lib/env";

export class ApiError extends Error {
  public readonly status: number;
  public readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

interface BackendErrorBody {
  error?: { message?: string; details?: unknown };
}

// Set by AuthContext once a session is established. Kept in memory only —
// never persisted (localStorage/sessionStorage), matching the backend's
// design: the access token is short-lived and meant to be re-derived from
// the httpOnly refresh cookie on load, not stored client-side long-term.
let currentAccessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  currentAccessToken = token;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;

  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      // FormData bodies must NOT get a manually-set Content-Type — the
      // browser generates one itself (multipart/form-data with the
      // correct boundary), which fetch only does when the header is left
      // unset. Setting it here would produce a boundary-less/incorrect
      // header and break multipart parsing server-side.
      ...(options.body !== undefined && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...(currentAccessToken ? { Authorization: `Bearer ${currentAccessToken}` } : {}),
    },
    // Required so the httpOnly refresh-token cookie is sent/received
    // cross-origin between the Vite dev server and the API.
    credentials: "include",
    body: options.body === undefined ? undefined : isFormData ? (options.body as FormData) : JSON.stringify(options.body),
    signal: options.signal,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const data = (await res.json().catch(() => ({}))) as BackendErrorBody & T;

  if (!res.ok) {
    const body = data as BackendErrorBody;
    throw new ApiError(body.error?.message ?? "Request failed", res.status, body.error?.details);
  }

  return data as T;
}

export const apiClient = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { method: "GET", signal }),
  post: <T>(path: string, body?: unknown, signal?: AbortSignal) => request<T>(path, { method: "POST", body, signal }),
  patch: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: "PATCH", body, signal }),
  delete: <T>(path: string, signal?: AbortSignal) => request<T>(path, { method: "DELETE", signal }),
};
