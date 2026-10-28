const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
export const apiUrl = (path: string) => `${API_URL}${path}`;

export class ApiError extends Error {
  constructor(readonly status: number) {
    super(`API request failed with HTTP ${status}`);
    this.name = "ApiError";
  }
}

export const UNAUTHORIZED_EVENT = "owi:unauthorized";

export function signalUnauthorized(): void {
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}
