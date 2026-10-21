import { useQuery } from "@tanstack/react-query";
import { Zap, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { genUserName } from "@/lib/genUserName";
import type { LeaderboardEntry } from "@island-bitcoin/shared";

async function fetchWeeklyTop(): Promise<LeaderboardEntry[]> {
  const res = await fetch("/api/leaderboard?timeframe=weekly");
  if (!res.ok) throw new Error(`leaderboard fetch failed: ${res.status}`);
  return res.json();
}

const RANK_BADGE = ["🥇", "🥈", "🥉"];

/**
 * "Play & earn" teaser for the homepage: real weekly winners when the
 * games API is reachable, a plain explainer card when it isn't.
 */
export function TriviaPulse() {
  const { data: leaders } = useQuery({
    queryKey: ["leaderboard-teaser", "weekly"],
    queryFn: fetchWeeklyTop,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const top = (leaders ?? []).slice(0, 3);
  const hasData = top.length > 0;
  const canPlayNow = import.meta.env.VITE_FEATURE_TRIVIA_GAME === "true";

  return (
    <section className="py-12 sm:py-16">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-card overflow-hidden">
          <div className="p-6 sm:p-10 flex flex-col sm:flex-row items-center gap-8">
            <div className="flex-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-primary mb-4">
                <Zap className="h-3.5 w-3.5" />
                Real sats, really paid
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
                Play, answer, earn.
              </h2>
              <p className="text-muted-foreground mb-5">
                Bitcoin trivia runs at our meetups and online. Get the answers
                right, get sats straight to your wallet — no points programs,
                no tokens, no strings.
              </p>
              {canPlayNow ? (
                <button
                  onClick={() =>
                    document.getElementById("trivia-section")?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="inline-flex items-center gap-1 font-semibold text-primary hover:gap-2 transition-all"
                >
                  Play a round now
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <Link
                  to="/events"
                  className="inline-flex items-center gap-1 font-semibold text-primary hover:gap-2 transition-all"
                >
                  Win at the next meetup
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>

            {hasData && (
              <div className="w-full sm:w-72 shrink-0 rounded-xl border border-border bg-card p-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">
                  This week&#39;s sats leaders
                </p>
                <ol className="space-y-3">
                  {top.map((entry, i) => (
                    <li key={entry.pubkey} className="flex items-center gap-3">
                      <span className="text-lg w-6">{RANK_BADGE[i]}</span>
                      <span className="flex-1 text-sm font-medium text-foreground truncate">
                        {genUserName(entry.pubkey)}
                      </span>
                      <span className="text-sm font-bold text-primary tabular-nums whitespace-nowrap">
                        {entry.score.toLocaleString()} sats
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
