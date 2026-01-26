import { memo } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NostrFeed } from "@/components/social/NostrFeed";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const Sidebar = memo(function Sidebar({
  isOpen,
  onClose,
  className,
}: SidebarProps) {
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
        aria-label="Community feed sidebar"
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold">Community Feed</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <NostrFeed />
          </div>
        </div>
      </aside>
    </>
  );
});
