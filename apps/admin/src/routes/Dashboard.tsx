import type { ReactElement } from "react";
/**
 * Placeholder — verification queue, listing moderation, commission config, dispute queue and metrics
 * (docs/api-spec.md "Admin" section) arrive in the Admin dashboards phase (docs/architecture.md §9,
 * phase 9), once the modules they read from actually exist.
 */
export function Dashboard(): ReactElement {
  return (
    <main>
      <h1>Marketplace Admin (placeholder)</h1>
      <p>
        Verification queue, listing moderation, commission config, dispute
        queue, metrics — not yet implemented.
      </p>
    </main>
  );
}
