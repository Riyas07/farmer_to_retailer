import type { ReactElement } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { LoginPlaceholder } from "./routes/LoginPlaceholder";
import { FarmerHome } from "./routes/FarmerHome";
import { RetailerHome } from "./routes/RetailerHome";

/**
 * Foundation-phase routing shell — per ADR-0003, one app for both Farmer and Retailer roles, with
 * role-based routing after OTP login. Real role-aware auth/routing guards arrive with the Users phase;
 * this is just the skeleton so the shell is demoable now.
 */
export default function App(): ReactElement {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">Login</Link> | <Link to="/farmer">Farmer</Link> |{" "}
        <Link to="/retailer">Retailer</Link>
      </nav>
      <Routes>
        <Route path="/" element={<LoginPlaceholder />} />
        <Route path="/farmer" element={<FarmerHome />} />
        <Route path="/retailer" element={<RetailerHome />} />
      </Routes>
    </BrowserRouter>
  );
}
