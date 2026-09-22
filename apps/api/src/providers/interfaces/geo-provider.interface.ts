import type { LatLng } from "./common.types.js";

export interface GeoProvider {
  /** MVP: haversine distance from stored lat/lng, no external call needed. */
  distanceKm(a: LatLng, b: LatLng): number;
  /** Real Maps use (geocoding a free-text address, autocomplete) is opt-in and deferred. */
  geocode?(address: string): Promise<LatLng>;
  /** Derives the coarse point (docs/erd.md §3) stored as listings.display_lat/lng — a pure function,
   * not actually a network call, but kept on this interface since it's conceptually part of geo handling. */
  toDisplayPoint(exact: LatLng): LatLng;
}
