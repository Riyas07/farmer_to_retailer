/**
 * @nestjs/* (v12) ships ESM-only (`"type": "module"`, no CJS export condition) — see apps/api/README.md.
 * That means Jest has to load this package's own code as real ESM too (Node's native VM modules, run via
 * `NODE_OPTIONS=--experimental-vm-modules`, set on the "test" script in package.json), not ts-jest's
 * older transpile-to-CJS mode. Unit tests only (colocated *.spec.ts under src) — see docs/architecture.md
 * §9, e2e/integration suites arrive with the phases that give us something meaningful to exercise.
 *
 * No `preset` here on purpose: `extensionsToTreatAsEsm` + the `ts-jest`/`useESM: true` transform below are
 * the entire content of ts-jest's "default-esm" preset, spelled out directly instead of referenced by name.
 */

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { useESM: true }],
  },
  testRegex: "/src/.*\\.spec\\.ts$",
  moduleFileExtensions: ["js", "json", "ts"],
  collectCoverageFrom: ["src/**/*.(t|j)s"],
  coverageDirectory: "coverage",
};
