import { ApiError, apiUrl } from "./api";

export interface Vehicle {
  id: string;
  name: string;
  method: string;
}

export interface CrewIdentity {
  name: string;
  vehicle: Vehicle | null;
}

export async function fieldLogin(phone: string, pin: string): Promise<{ token: string; crew: CrewIdentity }> {
  const response = await fetch(apiUrl("/api/v1/auth/field-login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: phone.trim(), pin: pin.trim() }),
  });
  if (!response.ok) throw new ApiError(response.status);
  const body = (await response.json()) as { access_token: string; name: string; vehicle: Vehicle | null };
  return { token: body.access_token, crew: { name: body.name, vehicle: body.vehicle } };
}

export async function fetchIdentity(token: string): Promise<CrewIdentity> {
  const response = await fetch(apiUrl("/api/v1/auth/me"), { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new ApiError(response.status);
  const body = (await response.json()) as { name: string | null; vehicle: Vehicle | null };
  return { name: body.name ?? "", vehicle: body.vehicle };
}
