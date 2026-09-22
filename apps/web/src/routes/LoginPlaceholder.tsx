import type { ReactElement } from "react";
/**
 * Placeholder — real OTP login (POST /auth/otp/request, /auth/otp/verify per docs/api-spec.md) arrives
 * in the Users phase (docs/architecture.md §9). This just lets the role-based routing shell be
 * demoable end-to-end during Foundation phase without a working backend auth flow yet.
 */
export function LoginPlaceholder(): ReactElement {
  return (
    <main>
      <h1>Farmer ⇄ Retailer Marketplace</h1>
      <p>
        OTP login isn't implemented yet — this is a Foundation-phase
        placeholder.
      </p>
      <p>
        See <code>/farmer</code> and <code>/retailer</code> for the role-based
        shells this app will route into once auth exists.
      </p>
    </main>
  );
}
