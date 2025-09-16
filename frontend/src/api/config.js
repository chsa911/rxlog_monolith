// Use an env var in dev; leave empty in Docker so we call relative "/api/*"
export const API_BASE =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL)
    ? import.meta.env.VITE_API_BASE_URL
    : "";
