import { HaversineGeoProvider } from "./geo.provider.js";

describe("HaversineGeoProvider", () => {
  const geo = new HaversineGeoProvider();

  it("returns ~0 for the same point", () => {
    const p = { lat: 28.6139, lng: 77.209 }; // Delhi
    expect(geo.distanceKm(p, p)).toBeCloseTo(0, 5);
  });

  it("returns the known great-circle distance between Delhi and Mumbai (~1150km)", () => {
    const delhi = { lat: 28.6139, lng: 77.209 };
    const mumbai = { lat: 19.076, lng: 72.8777 };
    const km = geo.distanceKm(delhi, mumbai);
    expect(km).toBeGreaterThan(1100);
    expect(km).toBeLessThan(1200);
  });

  it("is symmetric", () => {
    const a = { lat: 12.9716, lng: 77.5946 }; // Bengaluru
    const b = { lat: 13.0827, lng: 80.2707 }; // Chennai
    expect(geo.distanceKm(a, b)).toBeCloseTo(geo.distanceKm(b, a), 9);
  });

  it("toDisplayPoint rounds to 2 decimal degrees so it never equals the exact point at higher precision", () => {
    const exact = { lat: 28.613939123, lng: 77.209023456 };
    const display = geo.toDisplayPoint(exact);
    expect(display).toEqual({ lat: 28.61, lng: 77.21 });
    // ~2 decimal degrees is on the order of a kilometre at these latitudes — docs/erd.md §3's "~1km" claim.
    expect(geo.distanceKm(exact, display)).toBeLessThan(2);
  });
});
