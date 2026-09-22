# ADR-0001 — ORM: Prisma over TypeORM

**Status**: Proposed

## Context
NestJS pairs natively with TypeORM (it's the framework's own docs' default example), but Prisma has become the
more common choice for new TypeScript backends because of its schema-first workflow, generated types, and
migration tooling.

## Decision
Use **Prisma** with `@nestjs/prisma` (or a thin custom module) wrapping the generated client per-module.

## Why
- The `docs/erd.md` schema maps almost 1:1 onto a `schema.prisma` file — keeping the ERD and the actual schema
  in sync is easier when the schema file itself is the readable source of truth.
- Generated types give us compile-time safety across all modules without hand-written entity classes.
- Prisma Migrate gives clean, reviewable SQL migration files, which matters for a money-handling schema where
  we want migrations to be easy to read in PR review.

## Alternatives considered
- **TypeORM** — more idiomatic in "classic" NestJS tutorials, decorator-based entities live next to the module
  that owns them (arguably fits our "no cross-module raw queries" rule even more naturally). Reasonable fallback
  if the team is already more fluent in it.

## Consequences
- One additional build step (`prisma generate`) in CI.
- Module boundary discipline (no module querying another module's tables directly) has to be enforced by
  convention/code review, since Prisma's client isn't naturally scoped per-module the way TypeORM repositories
  injected into a module are. We'll wrap each module's Prisma access behind that module's own repository class
  to keep the boundary real, not just aspirational.
