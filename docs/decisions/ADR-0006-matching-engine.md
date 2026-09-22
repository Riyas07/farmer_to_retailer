# ADR-0006 — Matching engine is a scored filter, not ML

**Status**: Proposed

## Context
The brief asks for "a simple matching engine" connecting retailer demand to farmer listings.

## Decision
V1's matching engine is a **stateless query + scoring function** inside the `catalog`/`matching` module:
retailer-supplied filters (category, crop, quantity, price range, pickup radius) narrow the candidate set via a
normal SQL query, then results are sorted by a simple weighted score of `distanceKm` (via haversine on stored
lat/lng — no external Maps call needed), `price`, and `listing freshness` (how recently created/updated). No
machine learning, no offline model, no recommendation/personalization based on past behavior.

## Why
- There's no behavioral data yet to train or even meaningfully hand-tune a recommender against — building one
  now would be optimizing against guesses.
- A deterministic, explainable scoring function is also just easier to debug when a farmer or retailer asks "why
  didn't I see X" — important for trust in an early marketplace.

## Alternatives considered
- **ML-based ranking** — explicitly out of scope; revisit once there's enough transaction history (accepted
  negotiations, completed orders) to have real signal, and once "relevance" is a proven bottleneck rather than a
  guess.

## Consequences
- The `GeoProvider.distanceKm` interface uses haversine math only for V1 — no Google Maps API key or billing
  needed to ship matching/search, even though `GeoProvider.geocode` exists in the interface for later (e.g.
  turning a free-text address into lat/lng at profile-creation time, which *does* benefit from a real geocoder).
