import type { ReactElement } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Dashboard } from "./routes/Dashboard";

/**
 * Foundation-phase shell for the separate admin app (ADR-0003) — kept deployable to its own
 * URL/subdomain and never bundles admin-only strings/routes into apps/web's public bundle.
 */
export default function App(): ReactElement {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
