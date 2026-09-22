/**
 * @nestjs/* (v12) ships ESM-only (`"type": "module"`, no CJS export condition) — see apps/api/README.md.
 * That means Jest has to load this package's own code as real ESM too (Node's native VM modules, run via
 * `NODE_OPTIONS=--experimental-vm-modules`, set on the "test" script in package.json), not ts-jest's
 * older transpile-to-CJS mode. Unit tests only (colocated *.spec.ts under src) — see docs/architecture.md
 * §9, e2e/integration suites arrive with the phases that give us something meaningful to exercise.
 */

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  rootDir: "src",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { useESM: true }],
  },
  testRegex: ".*\\.spec\\.ts$",
  moduleFileExtensions: ["js", "json", "ts"],
  collectCoverageFrom: ["**/*.(t|j)s"],
  coverageDirectory: "../coverage",
};
