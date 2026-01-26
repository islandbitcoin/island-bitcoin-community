import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle, Clock, ArrowUpRight } from "lucide-react";
import type { GamePayout } from "@island-bitcoin/shared";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

interface PayoutsResponse {
  payouts: GamePayout[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

async function fetchPayouts(pubkey: string): Promise<PayoutsResponse> {
  const response = await fetch(`${API_BASE}/wallet/payouts?limit=100`, {
    headers: {
      Authorization: `Nostr ${pubkey}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch payouts");
  }

  return response.json();
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatGameType(type: string) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function StatusBadge({ status, gameType }: { status: string; gameType: string }) {
  const isWithdrawal = gameType === "withdrawal";

  switch (status) {
    case "paid":
      return (
        <Badge variant="default" className="bg-green-600">
          Completed
        </Badge>
      );
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    case "pending":
      return (
        <Badge
          variant="secondary"
          className={
            isWithdrawal
              ? "bg-blue-100 text-blue-800 border-blue-200 animate-pulse"
              : ""
          }
        >
          {isWithdrawal ? "Awaiting Payment" : "Pending"}
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "paid":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-600" />;
    case "pending":
      return <Clock className="h-4 w-4 text-yellow-600" />;
    default:
      return null;
  }
}

function PayoutRow({ payout }: { payout: GamePayout }) {
  const displayPubkey = `${payout.userPubkey.slice(0, 8)}...`;

  return (
    <TableRow>
      <TableCell className="font-medium">
        <span className="text-sm">{displayPubkey}</span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {payout.gameType === "withdrawal" && (
            <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
          )}
          {formatGameType(payout.gameType)}
        </div>
      </TableCell>
      <TableCell className="font-mono">{payout.amount} sats</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <StatusIcon status={payout.status} />
          <StatusBadge status={payout.status} gameType={payout.gameType} />
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatTimestamp(payout.timestamp)}
      </TableCell>
    </TableRow>
  );
}

function PayoutCard({ payout }: { payout: GamePayout }) {
  const displayPubkey = `${payout.userPubkey.slice(0, 8)}...`;

  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">{displayPubkey}</div>
            <div className="text-xs text-muted-foreground">
              {formatGameType(payout.gameType)}
            </div>
          </div>
          <StatusBadge status={payout.status} gameType={payout.gameType} />
        </div>

        <div className="flex justify-between items-center">
          <div>
            <div className="text-lg font-semibold">{payout.amount} sats</div>
            <div className="text-xs text-muted-foreground">
              {formatTimestamp(payout.timestamp)}
            </div>
          </div>
          {payout.gameType === "withdrawal" && (
            <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
          )}
        </div>

        {payout.pullPaymentId && (
          <div className="text-xs text-muted-foreground">
            {payout.pullPaymentId.startsWith("internal_") ? (
              <span>Internal transfer</span>
            ) : payout.pullPaymentId.startsWith("pullpayment_") ? (
              <span>Pull payment generated</span>
            ) : (
              <span className="font-mono">
                ID: {payout.pullPaymentId.slice(0, 16)}...
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

export function PayoutsTable() {
  const { user } = useCurrentUser();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-payouts", user?.pubkey],
    queryFn: () => fetchPayouts(user!.pubkey),
    enabled: !!user?.pubkey,
    staleTime: 30 * 1000,
  });

  const sortedPayouts = useMemo(() => {
    if (!data?.payouts) return [];
    return [...data.payouts].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [data?.payouts]);

  const totalAmount = useMemo(() => {
    return sortedPayouts.reduce((sum, p) => sum + p.amount, 0);
  }, [sortedPayouts]);

  if (isLoading) {
    return (
      <div
        data-testid="loading-indicator"
        className="flex justify-center py-8"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (sortedPayouts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No payouts recorded yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden md:block rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Game</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPayouts.map((payout) => (
              <PayoutRow key={payout.id} payout={payout} />
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden space-y-3">
        {sortedPayouts.map((payout) => (
          <PayoutCard key={payout.id} payout={payout} />
        ))}
      </div>

      <div className="text-sm text-muted-foreground text-center md:text-left">
        Total payouts: {sortedPayouts.length} | Total amount:{" "}
        {totalAmount.toLocaleString()} sats
      </div>
    </div>
  );
}
