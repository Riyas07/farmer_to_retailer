/**
 * Small, genuinely shared shapes only. Endpoint-specific request/response DTOs are deliberately
 * NOT added here yet — they belong to the phase that builds each endpoint (see docs/architecture.md
 * §9), not to the Foundation-phase scaffold. Adding them speculatively now would just be guessing at
 * shapes ahead of the code that has to satisfy them.
 */

/** A point in WGS84 lat/lng — used for both exact and coarse (display) coordinates. See docs/erd.md §3. */
export interface LatLng {
  lat: number;
  lng: number;
}

export interface PaginatedQuery {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Standard error shape for every 4xx/5xx — see docs/api-spec.md. */
export interface ApiErrorShape {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown[];
}
