export interface GpsFix {
  lat: number;
  lng: number;
  accuracyM: number;
}

// One report must never block on GPS: patchy signal is the field norm,
// so we time out and let the report save without a location.
export function getFix(timeoutMs = 10_000): Promise<GpsFix | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({ lat: coords.latitude, lng: coords.longitude, accuracyM: coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}
