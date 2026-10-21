import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";

import Index from "./pages/Index";
import About from "./pages/About";
import Events from "./pages/Events";
import Gallery from "./pages/Gallery";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import AdminSetup from "./pages/AdminSetup";
import Setup from "./pages/Setup";
import Health from "./pages/Health";
import NotFound from "./pages/NotFound";

const PAGE_TITLES: Record<string, string> = {
  "/": "Island Bitcoin Community",
  "/about": "About · Island Bitcoin Community",
  "/events": "Events · Island Bitcoin Community",
  "/gallery": "Gallery · Island Bitcoin Community",
};

function PageTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = PAGE_TITLES[pathname] ?? "Island Bitcoin Community";
  }, [pathname]);
  return null;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <PageTitle />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/about" element={<About />} />
        <Route path="/events" element={<Events />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin-setup" element={<AdminSetup />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/health" element={<Health />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
