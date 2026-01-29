import { useRef, useState } from "react";
import { Shield, Upload, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLoginActions } from "@/hooks/useLoginActions";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";

interface LoginButtonProps {
  className?: string;
  onLogin?: () => void;
}

export function LoginButton({ className, onLogin }: LoginButtonProps) {
  const { user } = useCurrentUser();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [nsec, setNsec] = useState("");
  const [nsecError, setNsecError] = useState("");
  const [bunkerUri, setBunkerUri] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const login = useLoginActions();

  const handleExtensionLogin = async () => {
    setIsLoading(true);
    try {
      if (!("nostr" in window)) {
        throw new Error("Nostr extension not found. Please install a NIP-07 extension.");
      }
      await login.extension();
      onLogin?.();
      setIsOpen(false);
    } catch (error) {
      console.error("Extension login failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyLogin = () => {
    if (!nsec.trim()) return;
    setIsLoading(true);
    setNsecError("");

    try {
      login.nsec(nsec);
      onLogin?.();
      setIsOpen(false);
    } catch (error) {
      console.error("Nsec login failed:", error);
      setNsecError("Invalid NSEC format. Please check for typos or try copying it again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBunkerLogin = async () => {
    if (!bunkerUri.trim() || !bunkerUri.startsWith("bunker://")) return;
    setIsLoading(true);

    try {
      await login.bunker(bunkerUri);
      onLogin?.();
      setIsOpen(false);
    } catch (error) {
      console.error("Bunker login failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setNsec(content.trim());
    };
    reader.readAsText(file);
  };

  if (user) {
    return null;
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground font-medium transition-all hover:bg-primary/90",
          className
        )}
      >
        <User className="w-4 h-4" />
        <span className="truncate">Log in</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="px-6 pt-6 pb-0 relative">
            <DialogTitle className="text-xl font-semibold text-center">
              Log in
            </DialogTitle>
            <DialogDescription className="text-center text-muted-foreground mt-2">
              Access your account securely with your preferred method
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-8 space-y-6">
            <Tabs
              defaultValue={"nostr" in window ? "extension" : "key"}
              className="w-full"
            >
              <TabsList className="grid grid-cols-3 mb-6">
                <TabsTrigger value="extension">Extension</TabsTrigger>
                <TabsTrigger value="key">Nsec</TabsTrigger>
                <TabsTrigger value="bunker">Bunker</TabsTrigger>
              </TabsList>

              <TabsContent value="extension" className="space-y-4">
                <div className="text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <Shield className="w-12 h-12 mx-auto mb-3 text-primary" />
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    Login with one click using the browser extension
                  </p>
                  <Button
                    className="w-full rounded-full py-6"
                    onClick={handleExtensionLogin}
                    disabled={isLoading}
                  >
                    {isLoading ? "Logging in..." : "Login with Extension"}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="key" className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="nsec"
                      className="text-sm font-medium text-gray-700 dark:text-gray-400"
                    >
                      Enter your nsec
                    </label>
                    <Input
                      id="nsec"
                      value={nsec}
                      onChange={(e) => {
                        setNsec(e.target.value);
                        setNsecError("");
                      }}
                      className="rounded-lg border-gray-300 dark:border-gray-700 focus-visible:ring-primary"
                      placeholder="nsec1..."
                    />
                    {nsecError && (
                      <p className="text-red-500 text-xs mt-1">
                        {nsecError}
                      </p>
                    )}
                  </div>

                  <div className="text-center">
                    <p className="text-sm mb-2 text-gray-600 dark:text-gray-400">
                      Or upload a key file
                    </p>
                    <input
                      type="file"
                      accept=".txt"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                    />
                    <Button
                      variant="outline"
                      className="w-full dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Nsec File
                    </Button>
                  </div>

                  <Button
                    className="w-full rounded-full py-6 mt-4"
                    onClick={handleKeyLogin}
                    disabled={isLoading || !nsec.trim()}
                  >
                    {isLoading ? "Verifying..." : "Login with Nsec"}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="bunker" className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="bunkerUri"
                    className="text-sm font-medium text-gray-700 dark:text-gray-400"
                  >
                    Bunker URI
                  </label>
                  <Input
                    id="bunkerUri"
                    value={bunkerUri}
                    onChange={(e) => setBunkerUri(e.target.value)}
                    className="rounded-lg border-gray-300 dark:border-gray-700 focus-visible:ring-primary"
                    placeholder="bunker://"
                  />
                  {bunkerUri && !bunkerUri.startsWith("bunker://") && (
                    <p className="text-red-500 text-xs">
                      URI must start with bunker://
                    </p>
                  )}
                </div>

                <Button
                  className="w-full rounded-full py-6"
                  onClick={handleBunkerLogin}
                  disabled={
                    isLoading ||
                    !bunkerUri.trim() ||
                    !bunkerUri.startsWith("bunker://")
                  }
                >
                  {isLoading ? "Connecting..." : "Login with Bunker"}
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
