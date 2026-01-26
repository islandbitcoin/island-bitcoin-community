import { useState, useEffect, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { Coins, TrendingUp, Pickaxe, Zap, DollarSign, Trophy, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGameWallet } from "@/hooks/useGameWallet";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

interface StackerState {
  sats: number;
  totalSatsEarned: number;
  clickPower: number;
  autoMiners: number;
  lightningNodes: number;
  miningFarms: number;
  achievements: string[];
}

interface Upgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  icon: React.ReactNode;
  effect: () => void;
  owned: number;
}

const STORAGE_KEY = "satoshiStackerState";

function getStoredState(): StackerState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return {
    sats: 0,
    totalSatsEarned: 0,
    clickPower: 1,
    autoMiners: 0,
    lightningNodes: 0,
    miningFarms: 0,
    achievements: [],
  };
}

function saveState(state: StackerState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
}

export const SatoshiStacker = memo(function SatoshiStacker() {
  const [state, setState] = useState<StackerState>(getStoredState);
  const [isAnimating, setIsAnimating] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimsRemaining, setClaimsRemaining] = useState<number | null>(null);

  const { user } = useCurrentUser();
  const { refreshBalance } = useGameWallet();

  const passiveIncome =
    state.autoMiners * 1 + state.lightningNodes * 10 + state.miningFarms * 100;

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (passiveIncome === 0) return;

    const interval = setInterval(() => {
      setState((prev) => ({
        ...prev,
        sats: prev.sats + passiveIncome,
        totalSatsEarned: prev.totalSatsEarned + passiveIncome,
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [passiveIncome]);

  useEffect(() => {
    const checkAchievements = () => {
      if (state.totalSatsEarned >= 1000 && !state.achievements.includes("first-1k")) {
        setState((prev) => ({
          ...prev,
          achievements: [...prev.achievements, "first-1k"],
        }));
      }

      if (state.totalSatsEarned >= 100000 && !state.achievements.includes("first-100k")) {
        setState((prev) => ({
          ...prev,
          achievements: [...prev.achievements, "first-100k"],
        }));
      }

      if (state.totalSatsEarned >= 1000000 && !state.achievements.includes("first-million")) {
        setState((prev) => ({
          ...prev,
          achievements: [...prev.achievements, "first-million"],
        }));
      }
    };

    checkAchievements();
  }, [state.totalSatsEarned, state.achievements]);

  const handleClick = useCallback(() => {
    setIsAnimating(true);
    setState((prev) => ({
      ...prev,
      sats: prev.sats + prev.clickPower,
      totalSatsEarned: prev.totalSatsEarned + prev.clickPower,
    }));
    setTimeout(() => setIsAnimating(false), 200);
  }, []);

  const claimReward = async () => {
    if (!user?.pubkey || claimLoading) return;

    setClaimLoading(true);
    try {
      const response = await fetch(`${API_BASE}/stacker/claim`, {
        method: "POST",
        headers: {
          Authorization: `Nostr ${user.pubkey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setClaimsRemaining(data.claimsRemaining);
        refreshBalance();
      }
    } catch {
      // Ignore claim errors
    } finally {
      setClaimLoading(false);
    }
  };

  const buyUpgrade = (upgrade: Upgrade) => {
    if (state.sats < upgrade.cost) return;

    setState((prev) => ({ ...prev, sats: prev.sats - upgrade.cost }));
    upgrade.effect();
  };

  const upgrades: Upgrade[] = [
    {
      id: "click-power",
      name: "Better Mouse",
      description: "+1 sat per click",
      cost: Math.floor(10 * Math.pow(1.5, state.clickPower - 1)),
      icon: <Pickaxe className="h-4 w-4" />,
      effect: () => setState((prev) => ({ ...prev, clickPower: prev.clickPower + 1 })),
      owned: state.clickPower - 1,
    },
    {
      id: "auto-miner",
      name: "Auto Miner",
      description: "+1 sat/second",
      cost: Math.floor(100 * Math.pow(1.3, state.autoMiners)),
      icon: <Coins className="h-4 w-4" />,
      effect: () => setState((prev) => ({ ...prev, autoMiners: prev.autoMiners + 1 })),
      owned: state.autoMiners,
    },
    {
      id: "lightning-node",
      name: "Lightning Node",
      description: "+10 sats/second",
      cost: Math.floor(1000 * Math.pow(1.3, state.lightningNodes)),
      icon: <Zap className="h-4 w-4" />,
      effect: () =>
        setState((prev) => ({ ...prev, lightningNodes: prev.lightningNodes + 1 })),
      owned: state.lightningNodes,
    },
    {
      id: "mining-farm",
      name: "Mining Farm",
      description: "+100 sats/second",
      cost: Math.floor(10000 * Math.pow(1.3, state.miningFarms)),
      icon: <TrendingUp className="h-4 w-4" />,
      effect: () => setState((prev) => ({ ...prev, miningFarms: prev.miningFarms + 1 })),
      owned: state.miningFarms,
    },
  ];

  const btcValue = (state.sats / 100000000).toFixed(8);

  const nextMilestone =
    state.totalSatsEarned < 1000
      ? 1000
      : state.totalSatsEarned < 100000
        ? 100000
        : state.totalSatsEarned < 1000000
          ? 1000000
          : 10000000;

  const milestoneProgress = (state.totalSatsEarned / nextMilestone) * 100;

  return (
    <div className="rounded-lg border border-caribbean-sand bg-card p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Coins className="h-5 w-5 text-caribbean-mango" />
              Satoshi Stacker
            </h2>
            <p className="text-sm text-muted-foreground">
              Stack sats and build your Bitcoin empire!
            </p>
          </div>
          <span className="px-2 py-1 text-xs rounded-full border">
            {passiveIncome} sats/sec
          </span>
        </div>
      </div>

      <div className="space-y-6">
        <div className="text-center space-y-2">
          <div className="text-4xl font-bold text-caribbean-ocean">
            {formatNumber(state.sats)} sats
          </div>
          <div className="text-sm text-muted-foreground">= {btcValue} BTC</div>
          <div className="text-xs text-muted-foreground">
            Total earned: {formatNumber(state.totalSatsEarned)} sats
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <Button
            size="lg"
            onClick={handleClick}
            className={cn(
              "bg-caribbean-mango hover:bg-caribbean-mango/90 transition-all",
              "active:scale-95 select-none",
              isAnimating && "scale-110"
            )}
          >
            <Coins className="mr-2 h-5 w-5" />
            Stack Sats
            <span className="ml-2 text-xs opacity-75">+{state.clickPower}</span>
          </Button>

          {user && (
            <Button
              size="lg"
              variant="outline"
              onClick={claimReward}
              disabled={claimLoading}
              className="border-caribbean-ocean text-caribbean-ocean hover:bg-caribbean-ocean/10"
            >
              <Gift className="mr-2 h-5 w-5" />
              Claim Reward
              {claimsRemaining !== null && (
                <span className="ml-2 text-xs opacity-75">({claimsRemaining} left)</span>
              )}
            </Button>
          )}
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Upgrades
          </h4>

          {upgrades.map((upgrade) => (
            <div
              key={upgrade.id}
              className="flex items-center justify-between p-3 rounded-lg border border-caribbean-sand hover:border-caribbean-ocean/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="text-caribbean-ocean">{upgrade.icon}</div>
                <div>
                  <p className="font-medium text-sm">{upgrade.name}</p>
                  <p className="text-xs text-muted-foreground">{upgrade.description}</p>
                  {upgrade.owned > 0 && (
                    <p className="text-xs text-caribbean-palm mt-1">
                      Owned: {upgrade.owned}
                    </p>
                  )}
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => buyUpgrade(upgrade)}
                disabled={state.sats < upgrade.cost}
                className="min-w-[100px]"
              >
                {formatNumber(upgrade.cost)} sats
              </Button>
            </div>
          ))}
        </div>

        {state.achievements.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Achievements
            </h4>
            <div className="flex flex-wrap gap-2">
              {state.achievements.includes("first-1k") && (
                <span className="px-2 py-1 text-xs rounded-full bg-muted">
                  First 1K Sats
                </span>
              )}
              {state.achievements.includes("first-100k") && (
                <span className="px-2 py-1 text-xs rounded-full bg-muted">
                  100K Stacker
                </span>
              )}
              {state.achievements.includes("first-million") && (
                <span className="px-2 py-1 text-xs rounded-full bg-muted">
                  Satoshi Millionaire
                </span>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Next milestone</span>
            <span>{formatNumber(nextMilestone)} sats</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-caribbean-ocean transition-all"
              style={{ width: `${Math.min(milestoneProgress, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
});
