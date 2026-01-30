import { memo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { X, Home, Calendar, Image, Gamepad2, Trophy, Info, Settings, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NostrFeed } from "@/components/social/NostrFeed";
import { SidebarProfileCard } from "./SidebarProfileCard";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

const navItems = [
  { label: "Home", href: "/", icon: Home },
  { label: "Events", href: "/events", icon: Calendar },
  { label: "Gallery", href: "/gallery", icon: Image },
  { label: "Games", href: "/#trivia-section", icon: Gamepad2 },
  { label: "Leaderboard", href: null, icon: Trophy, comingSoon: true },
  { label: "About", href: "/about", icon: Info },
  { label: "Settings", href: "/settings", icon: Settings, requiresAuth: true },
];

export const Sidebar = memo(function Sidebar({
  isOpen,
  onClose,
  className,
}: SidebarProps) {
  const location = useLocation();
  const { user } = useCurrentUser();
  const [feedExpanded, setFeedExpanded] = useState(false);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-md bg-background border-l border-border z-50 transform transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
          className
        )}
        aria-label="Navigation sidebar"
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold">Menu</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <SidebarProfileCard />

            <nav className="p-4 space-y-2">
              {navItems.map((item) => {
                if (item.requiresAuth && !user) {
                  return null;
                }

                const isActive = item.href && location.pathname === item.href;
                const Icon = item.icon;

                if (item.href) {
                  return (
                    <Link
                      key={item.label}
                      to={item.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="flex-1">{item.label}</span>
                      {item.comingSoon && (
                        <Badge variant="secondary" className="text-xs">
                          Coming Soon
                        </Badge>
                      )}
                    </Link>
                  );
                }

                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground/50 cursor-not-allowed"
                  >
                    <Icon className="h-5 w-5" />
                    <span className="flex-1">{item.label}</span>
                    <Badge variant="secondary" className="text-xs">
                      Coming Soon
                    </Badge>
                  </div>
                );
              })}
            </nav>

            <div className="border-t border-border">
              <button
                onClick={() => setFeedExpanded(!feedExpanded)}
                className="w-full flex items-center justify-between p-4 text-sm font-medium hover:bg-muted transition-colors"
              >
                <span>Community Feed</span>
                {feedExpanded ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
              </button>
              {feedExpanded && (
                <div className="p-4 pt-0">
                  <NostrFeed />
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
});
