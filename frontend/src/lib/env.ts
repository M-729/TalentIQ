// Anything read from import.meta.env is bundled into the client build and
// therefore public. Never put secrets in VITE_-prefixed variables.
const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

if (!rawApiBaseUrl) {
  throw new Error(
    "VITE_API_BASE_URL is not set. Copy .env.example to .env and set it (e.g. http://localhost:4000/api/v1)."
  );
}

export const env = {
  apiBaseUrl: rawApiBaseUrl.replace(/\/$/, ""),
};
