import type { ReactNode } from "react";
import { useState } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
  className?: string;
  hideHeader?: boolean;
  hideFooter?: boolean;
}

export function Layout({
  children,
  className,
  hideHeader = false,
  hideFooter = false,
}: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className={cn("min-h-screen flex flex-col bg-background", className)}>
      {!hideHeader && <Header onMenuClick={() => setIsSidebarOpen(true)} />}
      <main role="main" className="flex-1">
        {children}
      </main>
      {!hideFooter && <Footer />}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
    </div>
  );
}
