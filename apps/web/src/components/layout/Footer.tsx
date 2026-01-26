import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FooterProps {
  className?: string;
}

export function Footer({ className }: FooterProps) {
  return (
    <footer
      role="contentinfo"
      className={cn(
        "py-8 sm:py-12 bg-muted/50 border-t border-border",
        className
      )}
    >
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Island Bitcoin. Built with B and islands
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Vibed with{" "}
              <a
                href="https://soapbox.pub/tools/mkstack/"
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                MKStack
              </a>
            </p>
          </div>
          <div className="flex gap-2 sm:gap-4">
            <Link to="/about">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground text-xs sm:text-sm"
              >
                About
              </Button>
            </Link>
            <Link to="/events">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground text-xs sm:text-sm"
              >
                Events
              </Button>
            </Link>
            <a
              href="https://github.com/islandbitcoin/islandbitcoin-community/tree/main/mediakit"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground text-xs sm:text-sm"
              >
                Media Kit
              </Button>
            </a>
            <Link to="/health">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground text-xs sm:text-sm"
              >
                Health
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
