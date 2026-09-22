import { Injectable } from "@nestjs/common";
import type { GeoProvider, LatLng } from "../interfaces/index.js";

const EARTH_RADIUS_KM = 6371;

/**
 * Real implementation (not mocked) — docs/architecture.md §5.1: "haversine + a simple rounding/grid-snap
 * for toDisplayPoint (no Maps API key needed for V1)". `geocode` is intentionally left unimplemented —
 * real Maps geocoding is opt-in and deferred.
 */
@Injectable()
export class HaversineGeoProvider implements GeoProvider {
  distanceKm(a: LatLng, b: LatLng): number {
    const dLat = toRadians(b.lat - a.lat);
    const dLng = toRadians(b.lng - a.lng);
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);

    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

    return EARTH_RADIUS_KM * c;
  }

  /**
   * Grid-snaps to ~2 decimal degrees (docs/erd.md: "roughly a 1km jitter/grid-snap") so a public/browse
   * listing never reveals a farmer's exact pickup point — see docs/erd.md §3.
   */
  toDisplayPoint(exact: LatLng): LatLng {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    return { lat: round2(exact.lat), lng: round2(exact.lng) };
  }
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}
