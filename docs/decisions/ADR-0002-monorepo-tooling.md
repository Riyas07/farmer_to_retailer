# ADR-0002 — Monorepo tooling: npm/pnpm workspaces, no Turborepo yet

**Status**: Proposed

## Context
Three deployables (`api`, `web`, `admin`) plus a shared types package need to live and build together.

## Decision
Use **pnpm workspaces** for the monorepo, with plain `pnpm --filter <app> run <script>` commands in CI. No
Turborepo/Nx build-graph tooling yet.

## Why
- pnpm's disk-efficient install and strict dependency resolution catches "phantom dependency" bugs early, which
  matters once `packages/shared-types` is depended on by three different apps.
- At three apps and one shared package, a build-graph/caching tool (Turborepo, Nx) is solving a problem we don't
  have yet — build times are small, and CI can just build all three in parallel jobs. Adding Turborepo later,
  if/when build times actually hurt, is a low-cost incremental change (it layers on top of workspaces, doesn't
  replace them).

## Alternatives considered
- **npm workspaces** — works fine too, slightly less strict about phantom deps. Would be a one-line change if
  preferred (no structural difference to the repo layout).
- **Turborepo from day one** — deferred per the "lean over complete" principle; revisit once CI times or
  cross-package caching actually become a pain point.

## Consequences
- Root `package.json` defines the workspaces; each app/package has its own `package.json` and can be deployed
  independently (they already need to be — `api` goes to ECS, `web`/`admin` go to S3/CloudFront).
