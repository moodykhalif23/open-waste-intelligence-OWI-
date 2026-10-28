import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { MapContainer, useMap } from "react-leaflet";
import { circleMarker, featureGroup, polyline, type LatLngTuple } from "leaflet";
import { leafletLayer } from "protomaps-leaflet";
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

const NAIROBI: LatLngTuple = [-1.2921, 36.8219];
const TILES_URL = "/tiles/nairobi/{z}/{x}/{y}.mvt";
const LAND = "#e2dfda";
const INK = "#101828";

function Layers({ data }: { data: string }) {
  const map = useMap();
  const fitted = useRef("");

  useEffect(() => {
    const { points, lines } = JSON.parse(data) as { points: MapPoint[]; lines: MapLine[] };
    const group = featureGroup();
    for (const ln of lines) {
      polyline(ln.points, {
        color: ln.color ?? INK,
        weight: 3,
        opacity: 0.75,
        lineCap: "round",
        lineJoin: "round",
        interactive: false,
      }).addTo(group);
    }
    for (const p of points) {
      const marker = circleMarker([p.lat, p.lng], {
        radius: 5,
        color: "#ffffff",
        weight: 1.5,
        fillColor: p.color ?? INK,
        fillOpacity: 1,
        interactive: Boolean(p.label),
      });
      if (p.label) marker.bindTooltip(p.label, { direction: "top", offset: [0, -4] });
      marker.addTo(group);
    }
    group.addTo(map);
    const bounds = group.getBounds();
    if (bounds.isValid() && bounds.toBBoxString() !== fitted.current) {
      fitted.current = bounds.toBBoxString();
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16, animate: false });
    }
    return () => {
      group.remove();
    };
  }, [map, data]);

  useEffect(() => {
    const basemap = leafletLayer({
      url: TILES_URL,
      flavor: "light",
      lang: "en",
      attribution: "© OpenStreetMap contributors · Protomaps",
    });
    basemap.addTo(map);
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(map.getContainer());
    return () => {
      resize.disconnect();
      basemap.remove();
    };
  }, [map]);

  return null;
}

// Flat self-hosted vector map with circle markers (avoids Leaflet's default-icon
// bundler snag) and optional route polylines. Auto-fits to the points.
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
  const data = JSON.stringify({ points: valid, lines: lines ?? [] });

  return (
    <Box sx={{ height, borderRadius: "4px", overflow: "hidden", border: "1px solid", borderColor: "divider" }}>
      <MapContainer
        center={NAIROBI}
        zoom={12}
        preferCanvas
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%", background: LAND }}
      >
        <Layers data={data} />
      </MapContainer>
    </Box>
  );
}
