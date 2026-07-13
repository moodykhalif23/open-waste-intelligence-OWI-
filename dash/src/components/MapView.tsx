import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import Box from "@mui/material/Box";

export interface MapPoint {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
}
export interface MapLine {
  points: [number, number][];
  color?: string;
}

const NAIROBI: LatLngExpression = [-1.2921, 36.8219];

// Flat OSM map with circle markers (avoids Leaflet's default-icon bundler
// snag) and optional route polylines. Auto-fits to the points.
export default function MapView({
  points,
  lines,
  height = 340,
}: {
  points: MapPoint[];
  lines?: MapLine[];
  height?: number;
}) {
  const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const first = valid[0];
  const center: LatLngExpression = first ? [first.lat, first.lng] : NAIROBI;
  const bounds: LatLngBoundsExpression | undefined =
    valid.length > 1 ? valid.map((p) => [p.lat, p.lng] as [number, number]) : undefined;

  return (
    <Box sx={{ height, borderRadius: "4px", overflow: "hidden", border: "1px solid", borderColor: "divider" }}>
      <MapContainer
        center={center}
        zoom={13}
        bounds={bounds}
        boundsOptions={{ padding: [30, 30] }}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {lines?.map((ln, i) => (
          <Polyline key={`l${i}`} positions={ln.points} pathOptions={{ color: ln.color ?? "#101828", weight: 3, opacity: 0.65 }} />
        ))}
        {valid.map((p, i) => (
          <CircleMarker
            key={`p${i}`}
            center={[p.lat, p.lng]}
            radius={7}
            pathOptions={{ color: "#ffffff", weight: 2, fillColor: p.color ?? "#101828", fillOpacity: 1 }}
          >
            {p.label && <Tooltip>{p.label}</Tooltip>}
          </CircleMarker>
        ))}
      </MapContainer>
    </Box>
  );
}
