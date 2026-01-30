import { useState, useCallback } from "react";
import { Zap, AlertCircle, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useWithdraw } from "@/hooks/useWithdraw";
import { cn } from "@/lib/utils";

interface PayoutButtonProps {
  balance: number;
  lightningAddress?: string;
  refreshBalance: () => void;
}

export function PayoutButton({
  balance,
  lightningAddress,
  refreshBalance,
}: PayoutButtonProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const [address, setAddress] = useState<string>(lightningAddress || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { withdraw } = useWithdraw();

  const handleWithdrawAll = useCallback(() => {
    setAmount(balance.toString());
  }, [balance]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      // Validation
      if (!amount || isNaN(Number(amount))) {
        setError("Please enter a valid amount");
        return;
      }

      const amountNum = Number(amount);
      if (amountNum < 100) {
        setError("Minimum withdrawal is 100 sats");
        return;
      }

      if (amountNum > balance) {
        setError("Insufficient balance");
        return;
      }

      if (!address.trim()) {
        setError("Lightning address is required");
        return;
      }

      setIsLoading(true);

      try {
        await withdraw(amountNum, address);
        setSuccess(true);
        setAmount("");
        setAddress(lightningAddress || "");
        refreshBalance();

        // Close dialog after success
        setTimeout(() => {
          setOpen(false);
          setSuccess(false);
        }, 2000);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Withdrawal failed. Please try again."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [amount, address, balance, withdraw, refreshBalance, lightningAddress]
  );

  const isValid =
    amount &&
    !isNaN(Number(amount)) &&
    Number(amount) >= 100 &&
    Number(amount) <= balance &&
    address.trim();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="default" className="gap-2">
          <Zap className="h-4 w-4" />
          Withdraw Sats
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw Sats</DialogTitle>
          <DialogDescription>
            Send your earnings to a Lightning address
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <p className="text-center font-medium">Withdrawal successful!</p>
            <p className="text-center text-sm text-muted-foreground">
              Your sats are on their way
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Balance Display */}
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm text-muted-foreground">Available Balance</p>
              <p className="text-2xl font-bold">{balance.toLocaleString()} sats</p>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <label htmlFor="amount" className="text-sm font-medium">
                Amount (sats)
              </label>
              <div className="flex gap-2">
                <input
                  id="amount"
                  type="number"
                  min="100"
                  max={balance}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError(null);
                  }}
                  placeholder="Enter amount"
                  className={cn(
                    "flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                    error && "border-destructive"
                  )}
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleWithdrawAll}
                  disabled={isLoading}
                >
                  All
                </Button>
              </div>
            </div>

            {/* Lightning Address Input */}
            <div className="space-y-2">
              <label htmlFor="address" className="text-sm font-medium">
                Lightning Address
              </label>
              <input
                id="address"
                type="text"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setError(null);
                }}
                placeholder="user@example.com"
                className={cn(
                  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                  error && "border-destructive"
                )}
                disabled={isLoading}
              />
            </div>

            {/* Warning if no address */}
            {!address.trim() && (
              <div className="flex gap-2 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p>Please enter a Lightning address to receive your sats</p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={!isValid || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Withdraw"
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
