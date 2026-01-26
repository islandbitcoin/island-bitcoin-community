import { BrowserRouter, Route, Routes } from "react-router-dom";

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

export function AppRouter() {
  return (
    <BrowserRouter>
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
