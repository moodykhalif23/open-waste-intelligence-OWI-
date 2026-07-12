const TOKEN_KEY = "owi-dash-token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function request(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${getToken() ?? ""}`,
      ...(typeof init?.body === "string" ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (response.status === 401) {
    clearToken();
    window.location.assign("/login");
    throw new Error("unauthorized");
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  return response;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return (await request(path, init)).json() as Promise<T>;
}

export async function apiBlob(path: string): Promise<Blob> {
  return (await request(path)).blob();
}

export async function login(phone: string, password: string): Promise<void> {
  const response = await fetch("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
  });
  if (!response.ok) throw new Error("login failed");
  const data = (await response.json()) as { access_token: string };
  setToken(data.access_token);
}

export type FillBand = "empty" | "low" | "half" | "high" | "overflowing";

export interface Site {
  id: string;
  name: string;
  site_type: string;
  ward: string | null;
}

export interface Bin {
  id: string;
  site_id: string;
  qr_code: string;
  lat: number;
  lng: number;
  volume_liters: number;
  bin_type: string;
}

export type Role = "admin" | "coordinator" | "collector" | "viewer";

export interface User {
  id: string;
  name: string;
  phone: string | null;
  role: Role;
}

export interface Observation {
  id: string;
  captured_at: string;
  synced_at: string;
  lat: number;
  lng: number;
  location_source: string;
  bin_id: string | null;
  collector_id: string | null;
  fill_tap: FillBand | null;
  privacy_status: string;
}
