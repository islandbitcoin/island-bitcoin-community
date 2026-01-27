import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAdminConfig } from "@/hooks/useAdminConfig";
import { useEvents } from "@/hooks/useEvents";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PayoutsTable } from "@/components/admin/PayoutsTable";
import {
  AlertCircle,
  Shield,
  ArrowUpRight,
  CheckCircle2,
  Zap,
  Coins,
  Loader2,
  Calendar,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

interface ProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
}

interface EventsTabProps {}

function EventsTab({}: EventsTabProps) {
   const [title, setTitle] = useState("");
   const [description, setDescription] = useState("");
   const [startDateTime, setStartDateTime] = useState("");
   const [endDateTime, setEndDateTime] = useState("");
   const [location, setLocation] = useState("");
   const [rsvpLink, setRsvpLink] = useState("");
   const [isPublishing, setIsPublishing] = useState(false);
   const [hasNostr, setHasNostr] = useState(false);
   const [editingEventId, setEditingEventId] = useState<string | null>(null);
   const { events, isLoading, refresh } = useEvents("all");

  useEffect(() => {
    setHasNostr(typeof window !== "undefined" && !!window.nostr);
  }, []);

  // Helper function to format ISO string to datetime-local format
  const formatDateTimeLocal = (isoString: string) => {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

   const handleEditEvent = (item: any) => {
     const event = item.event.event;
     setTitle(event.basic_info.title);
     setDescription(event.basic_info.description);
     setStartDateTime(formatDateTimeLocal(event.datetime.start));
     setEndDateTime(event.datetime.end ? formatDateTimeLocal(event.datetime.end) : "");
     setLocation(event.location?.name || "");
     setRsvpLink(event.registration?.url || "");
     setEditingEventId(event.id); // CRITICAL: Store the original d tag!
   };

   const handleCancelEdit = () => {
     setEditingEventId(null);
     setTitle("");
     setDescription("");
     setStartDateTime("");
     setEndDateTime("");
     setLocation("");
     setRsvpLink("");
   };

  const handlePublishEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!window.nostr) {
      alert("NIP-07 browser extension not found. Please install a Nostr signer extension.");
      return;
    }

    if (!title || !startDateTime) {
      alert("Title and Start Date/Time are required");
      return;
    }

    setIsPublishing(true);

    try {
      const startUnix = Math.floor(new Date(startDateTime).getTime() / 1000);
      const endUnix = endDateTime
        ? Math.floor(new Date(endDateTime).getTime() / 1000)
        : undefined;

      // CRITICAL: Preserve d tag when editing, generate new one when creating
      const uniqueId = editingEventId || `${title.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;

       const tags: string[][] = [
         ["d", uniqueId],
         ["title", title],
         ["start", startUnix.toString()],
       ];

       if (endUnix) {
         tags.push(["end", endUnix.toString()]);
       }

       if (location) {
         tags.push(["location", location]);
       }

       if (rsvpLink.trim()) {
         tags.push(["r", rsvpLink.trim()]);
       }

      const event = {
        kind: 31923,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: description,
        pubkey: "",
      };

      const signedEvent = await window.nostr.signEvent(event);

      let publishedToAny = false;
      const errors: string[] = [];

      for (const relay of RELAYS) {
        try {
          const ws = new WebSocket(relay);

          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              ws.close();
              reject(new Error("Connection timeout"));
            }, 5000);

            ws.onopen = () => {
              clearTimeout(timeout);
              ws.send(JSON.stringify(["EVENT", signedEvent]));
            };

            ws.onmessage = (event) => {
              const msg = JSON.parse(event.data);
              if (msg[0] === "OK") {
                publishedToAny = true;
                ws.close();
                resolve();
              }
            };

            ws.onerror = () => {
              clearTimeout(timeout);
              ws.close();
              reject(new Error(`Failed to connect to ${relay}`));
            };

            ws.onclose = () => {
              clearTimeout(timeout);
              if (!publishedToAny) {
                resolve();
              }
            };
          });
        } catch (error) {
          errors.push(
            error instanceof Error ? error.message : `Failed to publish to ${relay}`
          );
        }
      }

      if (publishedToAny) {
        alert(
          `Event ${editingEventId ? 'updated' : 'published'} successfully!\n\nEvent ID: ${signedEvent.id}\nTitle: ${title}`
        );
        handleCancelEdit();
        refresh();
      } else {
        alert(
          `Failed to publish event to any relay.\n\nErrors:\n${errors.join("\n")}`
        );
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Unknown error occurred";
      alert(`Error publishing event: ${errorMsg}`);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Card className="border-2 border-cyan-500/30 shadow-lg shadow-cyan-500/20 bg-slate-900/90 backdrop-blur">
      <CardHeader className="border-b border-cyan-500/20">
        <CardTitle className="text-2xl font-mono tracking-wide text-cyan-400 flex items-center gap-3">
          <span className="text-4xl">📅</span>
          {editingEventId ? `Editing: ${title}` : "Publish Calendar Event"}
        </CardTitle>
        <CardDescription className="text-slate-400 font-mono text-sm">
          // {editingEventId ? "Update the event details below" : "Create and publish a NIP-52 calendar event to Nostr relays 🌐"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {editingEventId && (
          <Alert className="border-purple-500/30 bg-purple-500/10">
            <AlertCircle className="h-4 w-4 text-purple-400" />
            <AlertDescription className="text-purple-300 font-mono">
              ✏️ Editing mode: Changes will update the existing event on all relays
            </AlertDescription>
          </Alert>
        )}

        {!hasNostr && (
          <Alert className="border-yellow-500/30 bg-yellow-500/10">
            <AlertCircle className="h-4 w-4 text-yellow-400" />
            <AlertDescription className="text-yellow-300 font-mono">
              ⚠️ NIP-07 browser extension not detected. Install a Nostr signer extension
              (like Alby or nos2x) to publish events.
            </AlertDescription>
          </Alert>
        )}

        {hasNostr && !editingEventId && (
          <Alert className="border-emerald-500/30 bg-emerald-500/10">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <AlertDescription className="text-emerald-300 font-mono">
              ✅ NIP-07 extension detected. Ready to publish events!
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handlePublishEvent} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="event-title" className="text-cyan-400/90 font-mono text-sm">Event Title * 📝</Label>
            <Input
              id="event-title"
              placeholder="e.g., Bitcoin Meetup 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={isPublishing}
              className="bg-slate-950 border-cyan-500/30 text-cyan-400 font-mono focus:border-cyan-400 focus:ring-cyan-400/50 placeholder:text-slate-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-description" className="text-cyan-400/90 font-mono text-sm">Description 📋</Label>
            <Textarea
              id="event-description"
              placeholder="Event details and description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isPublishing}
              rows={4}
              className="bg-slate-950 border-cyan-500/30 text-cyan-400 font-mono focus:border-cyan-400 focus:ring-cyan-400/50 placeholder:text-slate-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="event-start" className="text-cyan-400/90 font-mono text-sm">Start Date/Time * 🕐</Label>
              <Input
                id="event-start"
                type="datetime-local"
                value={startDateTime}
                onChange={(e) => setStartDateTime(e.target.value)}
                required
                disabled={isPublishing}
                className="bg-slate-950 border-cyan-500/30 text-cyan-400 font-mono focus:border-cyan-400 focus:ring-cyan-400/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-end" className="text-cyan-400/90 font-mono text-sm">End Date/Time 🕑</Label>
              <Input
                id="event-end"
                type="datetime-local"
                value={endDateTime}
                onChange={(e) => setEndDateTime(e.target.value)}
                disabled={isPublishing}
                className="bg-slate-950 border-cyan-500/30 text-cyan-400 font-mono focus:border-cyan-400 focus:ring-cyan-400/50"
              />
            </div>
          </div>

           <div className="space-y-2">
             <Label htmlFor="event-location" className="text-cyan-400/90 font-mono text-sm">Location 📍</Label>
             <Input
               id="event-location"
               placeholder="e.g., San Francisco, CA"
               value={location}
               onChange={(e) => setLocation(e.target.value)}
               disabled={isPublishing}
               className="bg-slate-950 border-cyan-500/30 text-cyan-400 font-mono focus:border-cyan-400 focus:ring-cyan-400/50 placeholder:text-slate-500"
             />
           </div>

           <div className="space-y-2">
             <Label htmlFor="event-rsvp" className="text-cyan-400/90 font-mono text-sm">RSVP Link 🔗</Label>
             <Input
               id="event-rsvp"
               type="url"
               placeholder="https://meetup.com/your-event"
               value={rsvpLink}
               onChange={(e) => setRsvpLink(e.target.value)}
               disabled={isPublishing}
               className="bg-slate-950 border-cyan-500/30 text-cyan-400 font-mono focus:border-cyan-400 focus:ring-cyan-400/50 placeholder:text-slate-500"
             />
           </div>

           <div className="flex gap-2">
            <Button
              type="submit"
              disabled={isPublishing || !hasNostr}
              className={`flex-1 font-mono ${!isPublishing && hasNostr ? 'bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 shadow-lg shadow-cyan-500/50 border border-cyan-400/30' : 'bg-slate-700 text-slate-400'}`}
            >
              {isPublishing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {editingEventId ? 'Updating...' : 'Publishing...'}
                </>
              ) : (
                <>
                  <Calendar className="mr-2 h-4 w-4" />
                  {editingEventId ? '✏️ Update Event' : '🚀 Publish Event'}
                </>
              )}
            </Button>
            {editingEventId && (
              <Button
                type="button"
                onClick={handleCancelEdit}
                disabled={isPublishing}
                variant="outline"
                className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 font-mono"
              >
                Cancel
              </Button>
            )}
          </div>
        </form>

        <Alert className="border-cyan-500/30 bg-cyan-500/10">
          <AlertCircle className="h-4 w-4 text-cyan-400" />
          <AlertDescription className="text-sm text-slate-300 font-mono">
            <strong className="text-cyan-400">How it works:</strong> Events are published to Nostr relays using
            NIP-52 (Calendar Events) standard. Your browser extension will sign the
            event with your private key. No private keys are stored on this server. 🔒
          </AlertDescription>
        </Alert>

        <div className="space-y-4 mt-6">
          <h3 className="text-lg font-mono text-cyan-400">📋 Published Events</h3>
          {isLoading && <p className="text-slate-400 font-mono">Loading events...</p>}
          {!isLoading && events.length === 0 && (
            <p className="text-slate-400 font-mono">No events published yet.</p>
          )}
          {events.map((item) => (
            <div key={item.event.event.id} className="flex justify-between items-center p-3 bg-slate-950 rounded border border-cyan-500/20">
              <div>
                <p className="font-mono text-cyan-400">{item.event.event.basic_info.title}</p>
                <p className="text-sm text-slate-400">
                  {new Date(item.event.event.datetime.start).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
                {item.event.event.location?.name && (
                  <p className="text-xs text-slate-500">{item.event.event.location.name}</p>
                )}
              </div>
              <Button
                onClick={() => handleEditEvent(item)}
                className="bg-cyan-600 hover:bg-cyan-500 text-white"
              >
                Edit
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}


type AdminSection = "rewards" | "limits" | "payouts" | "btcpay" | "admins" | "games" | "events";

const ADMIN_SECTIONS: { value: AdminSection; label: string; emoji: string }[] = [
  { value: "rewards", label: "Earnings", emoji: "💰" },
  { value: "limits", label: "Safety", emoji: "🛡️" },
  { value: "payouts", label: "Withdrawals", emoji: "💸" },
  { value: "btcpay", label: "Payment Setup", emoji: "⚡" },
  { value: "admins", label: "Admin Team", emoji: "👥" },
  { value: "games", label: "Game Settings", emoji: "🎮" },
  { value: "events", label: "Community Events", emoji: "📅" },
];

export default function Admin() {
  const { user } = useCurrentUser();
  const { config, isLoading, isAdmin, updateConfig, refreshConfig } = useAdminConfig();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null);
  const [activeSection, setActiveSection] = useState<AdminSection>("rewards");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-16">
        <div className="container mx-auto px-4">
          <Card className="max-w-md mx-auto border-2 border-cyan-500/30 shadow-lg shadow-cyan-500/20 bg-slate-900/90 backdrop-blur">
            <CardContent className="py-8">
              <div
                data-testid="loading-indicator"
                className="flex flex-col items-center gap-4"
              >
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
                <p className="text-cyan-400 font-mono">Loading configuration... ⚡</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin || !config) {
    const hasAdmins = config && config.adminPubkeys.length > 0;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-16">
        <div className="container mx-auto px-4">
          <Card className="max-w-md mx-auto border-2 border-red-500/30 shadow-lg shadow-red-500/20 bg-slate-900/90 backdrop-blur">
            <CardHeader className="border-b border-red-500/20">
              <CardTitle className="flex items-center gap-2 text-red-400 font-mono">
                <AlertCircle className="h-5 w-5" />
                Access Denied 🚫
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-center mb-4 text-slate-300 font-mono">
                {hasAdmins
                  ? "You must be an admin to access this page."
                  : "No admins have been configured yet."}
              </p>
              <div className="text-center space-x-2">
                {!hasAdmins && user && (
                  <Link to="/admin-setup">
                    <Button className="bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 shadow-lg shadow-cyan-500/50 border border-cyan-400/30 font-mono">
                      <Shield className="mr-2 h-4 w-4" />
                      🛡️ Setup Admin Access
                    </Button>
                  </Link>
                )}
                <Link to="/">
                  <Button variant="outline" className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 font-mono">
                    Return Home 🏠
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const handleRewardChange = (
    field: keyof typeof config.gameRewards,
    value: string
  ) => {
    const numValue = parseInt(value) || 0;
    updateConfig({
      gameRewards: {
        ...config.gameRewards,
        [field]: numValue,
      },
    });
  };

  const handleLimitChange = (
    field: keyof typeof config.rateLimits | "maxDailyPayout" | "maxPayoutPerUser" | "minWithdrawal",
    value: string
  ) => {
    const numValue = parseInt(value) || 0;
    if (field === "maxDailyPayout" || field === "maxPayoutPerUser" || field === "minWithdrawal") {
      updateConfig({ [field]: numValue });
    } else {
      updateConfig({
        rateLimits: {
          ...config.rateLimits,
          [field]: numValue,
        },
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-cyan-500/10 blur-3xl -z-10" />
          <h1 className="text-4xl font-mono font-bold tracking-wider bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-3">
            <span className="text-5xl">⚡</span>
            ADMIN CONTROL CENTER
            <span className="text-5xl">⚡</span>
          </h1>
          <p className="text-cyan-400/70 font-mono text-sm mt-3 tracking-wide">
            // Manage your Bitcoin paradise with cypherpunk style 🚀
          </p>
        </div>

        <Card className="mb-6 border-2 border-cyan-500/30 shadow-lg shadow-cyan-500/20 bg-slate-900/90 backdrop-blur">
          <CardHeader className="border-b border-cyan-500/20">
            <CardTitle className="flex items-center gap-2 text-cyan-400 font-mono tracking-wide">
              <span className="text-2xl">📊</span>
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-400 font-mono">Daily Limit 🔥</p>
                <p className="text-xl sm:text-2xl font-bold text-cyan-400 font-mono">
                  {config.maxDailyPayout.toLocaleString()} <span className="text-purple-400">sats</span>
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-400 font-mono">Withdrawal Method ⚡</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={config.oryToken ? "default" : "secondary"} className="font-mono">
                    {config.oryToken ? "Flash API" : "Not Configured"}
                  </Badge>
                  {config.autoApprove && (
                    <Badge variant="outline" className="text-xs border-cyan-500/30 text-cyan-400 font-mono">
                      Auto-approve ≤{config.autoApproveThreshold} sats
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  {config.oryToken
                    ? "Lightning Address payouts enabled 🚀"
                    : "Configure Flash API below 👇"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <div className="relative">
            <select
              value={activeSection}
              onChange={(e) => setActiveSection(e.target.value as AdminSection)}
              className="w-full appearance-none bg-slate-900/90 border-2 border-cyan-500/30 text-cyan-400 font-mono text-lg p-4 pr-12 rounded-lg focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/50 focus:outline-none shadow-lg shadow-cyan-500/20 cursor-pointer"
            >
              {ADMIN_SECTIONS.map((section) => (
                <option key={section.value} value={section.value} className="bg-slate-900 text-cyan-400">
                  {section.emoji} {section.label}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-cyan-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {activeSection === "rewards" && (
            <Card className="border-2 border-cyan-500/30 shadow-lg shadow-cyan-500/20 bg-slate-900/90 backdrop-blur">
              <CardHeader className="border-b border-cyan-500/20">
                <CardTitle className="text-2xl font-mono tracking-wide text-cyan-400 flex items-center gap-3">
                  <span className="text-4xl">💰</span>
                  Player Earnings Config
                </CardTitle>
                <CardDescription className="text-slate-400 font-mono text-sm">
                  // Set sats rewards for games and challenges 🎮
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="trivia-easy" className="text-cyan-400/90 font-mono text-sm">Trivia - Easy 🎯</Label>
                    <div className="relative">
                      <Input
                        id="trivia-easy"
                        type="number"
                        value={config.gameRewards.triviaEasy}
                        onChange={(e) =>
                          handleRewardChange("triviaEasy", e.target.value)
                        }
                        className="pr-16 bg-slate-950 border-cyan-500/30 text-cyan-400 font-mono focus:border-cyan-400 focus:ring-cyan-400/50"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-cyan-400/70 font-mono">
                        ⚡ sats
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trivia-medium" className="text-cyan-400/90 font-mono text-sm">Trivia - Medium 🎯🎯</Label>
                    <div className="relative">
                      <Input
                        id="trivia-medium"
                        type="number"
                        value={config.gameRewards.triviaMedium}
                        onChange={(e) =>
                          handleRewardChange("triviaMedium", e.target.value)
                        }
                        className="pr-16 bg-slate-950 border-cyan-500/30 text-cyan-400 font-mono focus:border-cyan-400 focus:ring-cyan-400/50"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-cyan-400/70 font-mono">
                        ⚡ sats
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trivia-hard" className="text-cyan-400/90 font-mono text-sm">Trivia - Hard 🎯🎯🎯</Label>
                    <div className="relative">
                      <Input
                        id="trivia-hard"
                        type="number"
                        value={config.gameRewards.triviaHard}
                        onChange={(e) =>
                          handleRewardChange("triviaHard", e.target.value)
                        }
                        className="pr-16 bg-slate-950 border-cyan-500/30 text-cyan-400 font-mono focus:border-cyan-400 focus:ring-cyan-400/50"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-cyan-400/70 font-mono">
                        ⚡ sats
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="daily-challenge" className="text-cyan-400/90 font-mono text-sm">Daily Challenge 🔥</Label>
                    <div className="relative">
                      <Input
                        id="daily-challenge"
                        type="number"
                        value={config.gameRewards.dailyChallenge}
                        onChange={(e) =>
                          handleRewardChange("dailyChallenge", e.target.value)
                        }
                        className="pr-16 bg-slate-950 border-cyan-500/30 text-cyan-400 font-mono focus:border-cyan-400 focus:ring-cyan-400/50"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-cyan-400/70 font-mono">
                        ⚡ sats
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="achievement-bonus" className="text-cyan-400/90 font-mono text-sm">Achievement Bonus 🏆</Label>
                    <div className="relative">
                      <Input
                        id="achievement-bonus"
                        type="number"
                        value={config.gameRewards.achievementBonus}
                        onChange={(e) =>
                          handleRewardChange("achievementBonus", e.target.value)
                        }
                        className="pr-16 bg-slate-950 border-cyan-500/30 text-cyan-400 font-mono focus:border-cyan-400 focus:ring-cyan-400/50"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-cyan-400/70 font-mono">
                        ⚡ sats
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="referral-bonus" className="text-cyan-400/90 font-mono text-sm">Referral Bonus 🤝</Label>
                    <div className="relative">
                      <Input
                        id="referral-bonus"
                        type="number"
                        value={config.gameRewards.referralBonus}
                        onChange={(e) =>
                          handleRewardChange("referralBonus", e.target.value)
                        }
                        className="pr-16 bg-slate-950 border-cyan-500/30 text-cyan-400 font-mono focus:border-cyan-400 focus:ring-cyan-400/50"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-cyan-400/70 font-mono">
                        ⚡ sats
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "limits" && (
            <Card className="border-2 border-cyan-500/30 shadow-lg shadow-cyan-500/20 bg-slate-900/90 backdrop-blur">
              <CardHeader className="border-b border-cyan-500/20">
                <CardTitle className="text-2xl font-mono tracking-wide text-cyan-400 flex items-center gap-3">
                  <span className="text-4xl">🛡️</span>
                  Safety Controls
                </CardTitle>
                <CardDescription className="text-slate-400 font-mono text-sm">
                  // Configure daily limits and anti-abuse protection 🔒
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="max-daily" className="text-cyan-400/90 font-mono text-sm">Max Daily Payout (Total) 📊</Label>
                    <div className="relative">
                      <Input
                        id="max-daily"
                        type="number"
                        value={config.maxDailyPayout}
                        onChange={(e) =>
                          handleLimitChange("maxDailyPayout", e.target.value)
                        }
                        className="pr-16 bg-slate-950 border-cyan-500/30 text-cyan-400 font-mono focus:border-cyan-400 focus:ring-cyan-400/50"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-cyan-400/70 font-mono">
                        ⚡ sats
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono">
                      Total sats that can be paid out per day
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max-user" className="text-cyan-400/90 font-mono text-sm">Max Per User Per Day 👤</Label>
                    <div className="relative">
                      <Input
                        id="max-user"
                        type="number"
                        value={config.maxPayoutPerUser}
                        onChange={(e) =>
                          handleLimitChange("maxPayoutPerUser", e.target.value)
                        }
                        className="pr-16 bg-slate-950 border-cyan-500/30 text-cyan-400 font-mono focus:border-cyan-400 focus:ring-cyan-400/50"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-cyan-400/70 font-mono">
                        ⚡ sats
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="min-withdrawal" className="text-cyan-400/90 font-mono text-sm">Minimum Withdrawal 💸</Label>
                    <div className="relative">
                      <Input
                        id="min-withdrawal"
                        type="number"
                        value={config.minWithdrawal}
                        onChange={(e) =>
                          handleLimitChange("minWithdrawal", e.target.value)
                        }
                        className="pr-16 bg-slate-950 border-cyan-500/30 text-cyan-400 font-mono focus:border-cyan-400 focus:ring-cyan-400/50"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-cyan-400/70 font-mono">
                        ⚡ sats
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trivia-limit" className="text-cyan-400/90 font-mono text-sm">Trivia Per Hour Limit ⏱️</Label>
                    <Input
                      id="trivia-limit"
                      type="number"
                      value={config.rateLimits.triviaPerHour}
                      onChange={(e) =>
                        handleLimitChange("triviaPerHour", e.target.value)
                      }
                      className="bg-slate-950 border-cyan-500/30 text-cyan-400 font-mono focus:border-cyan-400 focus:ring-cyan-400/50"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-4 rounded-lg border border-red-500/30 bg-red-500/10">
                  <Switch
                    id="maintenance"
                    checked={config.maintenanceMode}
                    onCheckedChange={(checked) =>
                      updateConfig({ maintenanceMode: checked })
                    }
                  />
                  <Label htmlFor="maintenance" className="cursor-pointer text-red-400 font-mono">
                    🚨 Maintenance Mode (disables all payouts)
                  </Label>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "payouts" && (
            <Card className="border-2 border-cyan-500/30 shadow-lg shadow-cyan-500/20 bg-slate-900/90 backdrop-blur">
              <CardHeader className="border-b border-cyan-500/20">
                <CardTitle className="text-2xl font-mono tracking-wide text-cyan-400 flex items-center gap-3">
                  <span className="text-4xl">💸</span>
                  Withdrawal History
                </CardTitle>
                <CardDescription className="text-slate-400 font-mono text-sm">
                  // Track all game payouts and withdrawals 📜
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <PayoutsTable />
              </CardContent>
            </Card>
          )}

          {activeSection === "btcpay" && (
            <div className="space-y-6">
              {!config.oryToken ? (
                <Card className="border-2 border-cyan-500/30 shadow-lg shadow-cyan-500/20 bg-slate-900/90 backdrop-blur">
                  <CardHeader className="border-b border-cyan-500/20">
                    <CardTitle className="text-2xl font-mono tracking-wide text-cyan-400 flex items-center gap-3">
                      <span className="text-4xl">⚡</span>
                      Connect Flash API
                    </CardTitle>
                    <CardDescription className="text-slate-400 font-mono text-sm">
                      Enable instant Lightning payouts to your players
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="p-4 rounded-lg border border-cyan-500/20 bg-slate-950/50 text-center">
                        <div className="text-3xl mb-2">1️⃣</div>
                        <h4 className="font-mono text-cyan-400 font-medium mb-1">Get API Token</h4>
                        <p className="text-xs text-slate-400 font-mono">Sign up at Flash and create an API token</p>
                      </div>
                      <div className="p-4 rounded-lg border border-cyan-500/20 bg-slate-950/50 text-center">
                        <div className="text-3xl mb-2">2️⃣</div>
                        <h4 className="font-mono text-cyan-400 font-medium mb-1">Paste Below</h4>
                        <p className="text-xs text-slate-400 font-mono">Enter your token in the form below</p>
                      </div>
                      <div className="p-4 rounded-lg border border-cyan-500/20 bg-slate-950/50 text-center">
                        <div className="text-3xl mb-2">3️⃣</div>
                        <h4 className="font-mono text-cyan-400 font-medium mb-1">Start Paying</h4>
                        <p className="text-xs text-slate-400 font-mono">Players withdraw to their Lightning Address</p>
                      </div>
                    </div>

                    <a
                      href="https://docs.flashapp.me"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full p-4 rounded-lg border-2 border-dashed border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-500/50 transition-all group"
                    >
                      <Zap className="h-5 w-5 text-purple-400 group-hover:text-purple-300" />
                      <span className="font-mono text-purple-400 group-hover:text-purple-300">
                        Get your API token at docs.flashapp.me →
                      </span>
                    </a>

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const oryToken = formData.get("oryToken") as string;
                        if (oryToken.trim()) {
                          await updateConfig({ oryToken: oryToken.trim() });
                        }
                      }}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="ory-token" className="text-cyan-400/90 font-mono text-sm">
                          Flash API Token
                        </Label>
                        <Input
                          id="ory-token"
                          name="oryToken"
                          type="password"
                          placeholder="flash_xxxxxxxxxxxxxxxxxxxxx"
                          className="bg-slate-950 border-cyan-500/30 text-cyan-400 font-mono focus:border-cyan-400 focus:ring-cyan-400/50 placeholder:text-slate-600"
                        />
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 shadow-lg shadow-cyan-500/50 border border-cyan-400/30 font-mono"
                      >
                        <Zap className="mr-2 h-4 w-4" />
                        Connect Flash API
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card className="border-2 border-emerald-500/30 shadow-lg shadow-emerald-500/20 bg-slate-900/90 backdrop-blur">
                    <CardContent className="py-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                          </div>
                          <div>
                            <h3 className="font-mono text-lg text-emerald-400 font-medium">Flash API Connected</h3>
                            <p className="text-sm text-slate-400 font-mono">Lightning payouts are enabled</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            if (confirm("Disconnect Flash API? Payouts will be disabled.")) {
                              await updateConfig({ oryToken: undefined, autoApprove: false });
                            }
                          }}
                          className="text-red-400 hover:text-red-300 border-red-500/30 hover:bg-red-500/10 font-mono"
                        >
                          Disconnect
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-cyan-500/30 shadow-lg shadow-cyan-500/20 bg-slate-900/90 backdrop-blur">
                    <CardHeader className="border-b border-cyan-500/20">
                      <CardTitle className="text-xl font-mono tracking-wide text-cyan-400 flex items-center gap-2">
                        <span className="text-2xl">🤖</span>
                        Auto-Approve Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                      <div className="flex items-center justify-between p-4 rounded-lg border border-cyan-500/30 bg-slate-950/50">
                        <div>
                          <Label className="text-cyan-400 font-mono">Auto-Approve Payouts</Label>
                          <p className="text-xs text-slate-400 font-mono mt-1">
                            Automatically process small withdrawals
                          </p>
                        </div>
                        <Switch
                          checked={config.autoApprove}
                          onCheckedChange={(checked) => updateConfig({ autoApprove: checked })}
                        />
                      </div>

                      {config.autoApprove && (
                        <div className="space-y-2">
                          <Label className="text-cyan-400/90 font-mono text-sm">
                            Maximum Auto-Approve Amount
                          </Label>
                          <div className="relative">
                            <Input
                              type="number"
                              min="1"
                              value={config.autoApproveThreshold}
                              onChange={(e) => updateConfig({ autoApproveThreshold: parseInt(e.target.value) || 100 })}
                              className="pr-16 bg-slate-950 border-cyan-500/30 text-cyan-400 font-mono focus:border-cyan-400 focus:ring-cyan-400/50"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-cyan-400/70 font-mono">
                              sats
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-mono">
                            Withdrawals up to {config.autoApproveThreshold.toLocaleString()} sats process instantly
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-cyan-500/30 shadow-lg shadow-cyan-500/20 bg-slate-900/90 backdrop-blur">
                    <CardHeader className="border-b border-cyan-500/20">
                      <CardTitle className="text-xl font-mono tracking-wide text-cyan-400 flex items-center gap-2">
                        <span className="text-2xl">🚀</span>
                        Process Pending Payouts
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                      <p className="text-sm text-slate-400 font-mono">
                        Manually process all pending withdrawal requests via Flash API.
                      </p>
                      
                      <Button
                        onClick={async () => {
                          if (!confirm("Process all pending payouts now?")) return;
                          setIsProcessing(true);
                          setProcessResult(null);
                          try {
                            const response = await fetch(`${API_BASE}/admin/payouts/process`, {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Nostr ${user?.pubkey}`,
                              },
                              body: JSON.stringify({
                                autoApprove: config.autoApprove,
                                threshold: config.autoApproveThreshold,
                              }),
                            });
                            if (!response.ok) throw new Error("Failed to process payouts");
                            const result = await response.json();
                            setProcessResult(result);
                            refreshConfig();
                          } catch (error) {
                            console.error("Error processing payouts:", error);
                            setProcessResult({ processed: 0, succeeded: 0, failed: 0 });
                          } finally {
                            setIsProcessing(false);
                          }
                        }}
                        disabled={isProcessing}
                        className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 shadow-lg shadow-emerald-500/50 border border-emerald-400/30 font-mono"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <ArrowUpRight className="mr-2 h-4 w-4" />
                            Process All Pending
                          </>
                        )}
                      </Button>

                      {processResult && (
                        <div className={`p-4 rounded-lg border ${processResult.failed > 0 ? 'border-yellow-500/30 bg-yellow-500/10' : 'border-emerald-500/30 bg-emerald-500/10'}`}>
                          <div className="flex items-center gap-2 font-mono">
                            <CheckCircle2 className={`h-4 w-4 ${processResult.failed > 0 ? 'text-yellow-400' : 'text-emerald-400'}`} />
                            <span className="text-slate-300">
                              Processed {processResult.processed}:
                            </span>
                            <span className="text-emerald-400">{processResult.succeeded} sent</span>
                            {processResult.failed > 0 && (
                              <span className="text-red-400">{processResult.failed} failed</span>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          )}

          {activeSection === "admins" && (
            <Card className="border-2 border-cyan-500/30 shadow-lg shadow-cyan-500/20 bg-slate-900/90 backdrop-blur">
              <CardHeader className="border-b border-cyan-500/20">
                <CardTitle className="text-2xl font-mono tracking-wide text-cyan-400 flex items-center gap-3">
                  <span className="text-4xl">👥</span>
                  Admin Team
                </CardTitle>
                <CardDescription className="text-slate-400 font-mono text-sm">
                  // Manage admin access to the game wallet 🔐
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-cyan-400/90 font-mono text-sm">Current Admins 🛡️</Label>
                    <div className="mt-2 space-y-2">
                      {config.adminPubkeys.length === 0 ? (
                        <p className="text-sm text-slate-400 font-mono">
                          No admins configured
                        </p>
                      ) : (
                        config.adminPubkeys.map((pubkey) => (
                          <div
                            key={pubkey}
                            className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-cyan-500/30"
                          >
                            <code className="text-xs text-cyan-400 font-mono">
                              {pubkey.slice(0, 16)}...{pubkey.slice(-8)}
                            </code>
                            {pubkey === user.pubkey && (
                              <Badge variant="secondary" className="font-mono bg-purple-500/20 text-purple-400 border-purple-500/30">⭐ You</Badge>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <Alert className="border-cyan-500/30 bg-cyan-500/10">
                    <AlertCircle className="h-4 w-4 text-cyan-400" />
                    <AlertDescription className="text-slate-300 font-mono text-sm">
                      To add or remove admins, use the game wallet CLI or contact
                      the system administrator. 💻
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>
          )}

           {activeSection === "games" && (
             <Card className="border-2 border-cyan-500/30 shadow-lg shadow-cyan-500/20 bg-slate-900/90 backdrop-blur">
               <CardHeader className="border-b border-cyan-500/20">
                 <CardTitle className="text-2xl font-mono tracking-wide text-cyan-400 flex items-center gap-3">
                   <span className="text-4xl">🎮</span>
                   Game Settings
                 </CardTitle>
                 <CardDescription className="text-slate-400 font-mono text-sm">
                   // Control which games are available to users 🕹️
                 </CardDescription>
               </CardHeader>
               <CardContent className="space-y-4 pt-6">
                 <div className="space-y-4">
                   <div className="flex items-center justify-between p-4 rounded-lg border border-cyan-500/30 bg-slate-950/50 hover:border-cyan-400/50 transition-colors">
                     <div className="space-y-1">
                       <div className="flex items-center gap-2">
                         <Coins className="h-5 w-5 text-cyan-400" />
                         <h4 className="font-mono font-medium text-cyan-400">Satoshi Stacker ⚡</h4>
                       </div>
                       <p className="text-sm text-slate-400 font-mono">
                         A clicker game where users can stack sats and earn real
                         Bitcoin rewards through proof of work 💪
                       </p>
                     </div>
                     <Switch
                       id="satoshi-stacker"
                       checked={config.gameVisibility.satoshiStacker}
                       onCheckedChange={(checked) =>
                         updateConfig({
                           gameVisibility: {
                             ...config.gameVisibility,
                             satoshiStacker: checked,
                           },
                         })
                       }
                     />
                   </div>
                 </div>

                 <Alert className="border-cyan-500/30 bg-cyan-500/10">
                   <AlertCircle className="h-4 w-4 text-cyan-400" />
                   <AlertDescription className="text-slate-300 font-mono text-sm">
                     Games marked as hidden will not appear in the Bitcoin Education
                     Games section. Only admins can change game visibility settings. 👁️
                   </AlertDescription>
                 </Alert>
               </CardContent>
             </Card>
           )}

           {activeSection === "events" && (
             <EventsTab />
           )}
        </div>
      </div>
    </div>
  );
}
