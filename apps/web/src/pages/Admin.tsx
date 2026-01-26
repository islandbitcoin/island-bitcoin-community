import { Link } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAdminConfig } from "@/hooks/useAdminConfig";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { PayoutsTable } from "@/components/admin/PayoutsTable";
import {
  Users,
  AlertCircle,
  Shield,
  DollarSign,
  ArrowUpRight,
  CheckCircle2,
  QrCode,
  Coins,
} from "lucide-react";

export default function Admin() {
  const { user } = useCurrentUser();
  const { config, isLoading, isAdmin, updateConfig } = useAdminConfig();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-amber-50/30 py-16">
        <div className="container mx-auto px-4">
          <Card className="max-w-md mx-auto">
            <CardContent className="py-8">
              <div
                data-testid="loading-indicator"
                className="flex flex-col items-center gap-4"
              >
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                <p className="text-muted-foreground">Loading configuration...</p>
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
      <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-amber-50/30 py-16">
        <div className="container mx-auto px-4">
          <Card className="max-w-md mx-auto border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                Access Denied
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center mb-4">
                {hasAdmins
                  ? "You must be an admin to access this page."
                  : "No admins have been configured yet."}
              </p>
              <div className="text-center space-x-2">
                {!hasAdmins && user && (
                  <Link to="/admin-setup">
                    <Button className="bg-primary hover:bg-primary/90">
                      <Shield className="mr-2 h-4 w-4" />
                      Setup Admin Access
                    </Button>
                  </Link>
                )}
                <Link to="/">
                  <Button variant="outline">Return Home</Button>
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
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-amber-50/30 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Game Wallet Admin</h1>
          <p className="text-muted-foreground mt-2">
            Manage game rewards and wallet configuration
          </p>
        </div>

        <Card className="mb-6 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Today's Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Daily Limit</p>
                <p className="text-xl sm:text-2xl font-bold">
                  {config.maxDailyPayout.toLocaleString()} sats
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Withdrawal Method</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={config.pullPaymentId ? "default" : "secondary"}>
                    {config.pullPaymentId ? "Pull Payments" : "Not Configured"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {config.pullPaymentId
                    ? "Instant QR code withdrawals"
                    : "Configure pull payments below"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="rewards" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 gap-1">
            <TabsTrigger value="rewards" className="text-xs md:text-sm">
              <DollarSign className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
              <span>Rewards</span>
            </TabsTrigger>
            <TabsTrigger value="limits" className="text-xs md:text-sm">
              <Shield className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
              <span>Limits</span>
            </TabsTrigger>
            <TabsTrigger value="payouts" className="text-xs md:text-sm">
              <ArrowUpRight className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
              <span>Payouts</span>
            </TabsTrigger>
            <TabsTrigger value="btcpay" className="text-xs md:text-sm">
              <QrCode className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
              <span>Pull Payments</span>
            </TabsTrigger>
            <TabsTrigger value="admins" className="text-xs md:text-sm">
              <Users className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
              <span>Admins</span>
            </TabsTrigger>
            <TabsTrigger value="games" className="text-xs md:text-sm">
              <Coins className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
              <span>Games</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rewards">
            <Card>
              <CardHeader>
                <CardTitle>Game Rewards</CardTitle>
                <CardDescription>
                  Configure sats rewards for each game type
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="trivia-easy">Trivia - Easy</Label>
                    <div className="relative">
                      <Input
                        id="trivia-easy"
                        type="number"
                        value={config.gameRewards.triviaEasy}
                        onChange={(e) =>
                          handleRewardChange("triviaEasy", e.target.value)
                        }
                        className="pr-12"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        sats
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trivia-medium">Trivia - Medium</Label>
                    <div className="relative">
                      <Input
                        id="trivia-medium"
                        type="number"
                        value={config.gameRewards.triviaMedium}
                        onChange={(e) =>
                          handleRewardChange("triviaMedium", e.target.value)
                        }
                        className="pr-12"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        sats
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trivia-hard">Trivia - Hard</Label>
                    <div className="relative">
                      <Input
                        id="trivia-hard"
                        type="number"
                        value={config.gameRewards.triviaHard}
                        onChange={(e) =>
                          handleRewardChange("triviaHard", e.target.value)
                        }
                        className="pr-12"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        sats
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="daily-challenge">Daily Challenge</Label>
                    <div className="relative">
                      <Input
                        id="daily-challenge"
                        type="number"
                        value={config.gameRewards.dailyChallenge}
                        onChange={(e) =>
                          handleRewardChange("dailyChallenge", e.target.value)
                        }
                        className="pr-12"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        sats
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="achievement-bonus">Achievement Bonus</Label>
                    <div className="relative">
                      <Input
                        id="achievement-bonus"
                        type="number"
                        value={config.gameRewards.achievementBonus}
                        onChange={(e) =>
                          handleRewardChange("achievementBonus", e.target.value)
                        }
                        className="pr-12"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        sats
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="referral-bonus">Referral Bonus</Label>
                    <div className="relative">
                      <Input
                        id="referral-bonus"
                        type="number"
                        value={config.gameRewards.referralBonus}
                        onChange={(e) =>
                          handleRewardChange("referralBonus", e.target.value)
                        }
                        className="pr-12"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        sats
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="limits">
            <Card>
              <CardHeader>
                <CardTitle>Payout Limits & Anti-Abuse</CardTitle>
                <CardDescription>
                  Configure daily limits and rate limiting
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="max-daily">Max Daily Payout (Total)</Label>
                    <div className="relative">
                      <Input
                        id="max-daily"
                        type="number"
                        value={config.maxDailyPayout}
                        onChange={(e) =>
                          handleLimitChange("maxDailyPayout", e.target.value)
                        }
                        className="pr-12"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        sats
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Total sats that can be paid out per day
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max-user">Max Per User Per Day</Label>
                    <div className="relative">
                      <Input
                        id="max-user"
                        type="number"
                        value={config.maxPayoutPerUser}
                        onChange={(e) =>
                          handleLimitChange("maxPayoutPerUser", e.target.value)
                        }
                        className="pr-12"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        sats
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="min-withdrawal">Minimum Withdrawal</Label>
                    <div className="relative">
                      <Input
                        id="min-withdrawal"
                        type="number"
                        value={config.minWithdrawal}
                        onChange={(e) =>
                          handleLimitChange("minWithdrawal", e.target.value)
                        }
                        className="pr-12"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        sats
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trivia-limit">Trivia Per Hour Limit</Label>
                    <Input
                      id="trivia-limit"
                      type="number"
                      value={config.rateLimits.triviaPerHour}
                      onChange={(e) =>
                        handleLimitChange("triviaPerHour", e.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="maintenance"
                    checked={config.maintenanceMode}
                    onCheckedChange={(checked) =>
                      updateConfig({ maintenanceMode: checked })
                    }
                  />
                  <Label htmlFor="maintenance" className="cursor-pointer">
                    Maintenance Mode (disables all payouts)
                  </Label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payouts">
            <Card>
              <CardHeader>
                <CardTitle>Payout History</CardTitle>
                <CardDescription>
                  Track all game payouts and withdrawals
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PayoutsTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="btcpay">
            <Card>
              <CardHeader>
                <CardTitle>Pull Payment Configuration</CardTitle>
                <CardDescription>
                  Configure BTCPay Server pull payment for instant QR code
                  withdrawals
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {config.pullPaymentId && config.btcPayServerUrl ? (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription>
                      Pull payment is configured and ready for instant withdrawals
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Configure pull payment to enable instant QR code withdrawals
                    </AlertDescription>
                  </Alert>
                )}

                <Alert className="border-blue-200 bg-blue-50">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-sm">
                    <strong>How it works:</strong> Users generate QR codes
                    instantly using your BTCPay Server pull payment. Create a pull
                    payment in BTCPay Server, then enter the ID and server URL
                    below.
                  </AlertDescription>
                </Alert>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const serverUrl = formData.get("serverUrl") as string;
                    const storeId = formData.get("storeId") as string;
                    const apiKey = formData.get("apiKey") as string;
                    const pullPaymentId = formData.get("pullPaymentId") as string;

                    await updateConfig({
                      btcPayServerUrl: serverUrl.trim() || undefined,
                      btcPayStoreId: storeId.trim() || undefined,
                      btcPayApiKey: apiKey.trim() || undefined,
                      pullPaymentId: pullPaymentId.trim() || undefined,
                    });
                  }}
                  className="space-y-4"
                >
                  <div>
                    <Label htmlFor="server-url">BTCPay Server URL</Label>
                    <Input
                      id="server-url"
                      name="serverUrl"
                      type="url"
                      placeholder="https://your-btcpay-server.com"
                      defaultValue={config.btcPayServerUrl || ""}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      The URL of your BTCPay Server instance
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="store-id">Store ID</Label>
                    <Input
                      id="store-id"
                      name="storeId"
                      type="text"
                      placeholder="STORE123..."
                      defaultValue={config.btcPayStoreId || ""}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Your BTCPay Store ID (found in Store Settings)
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="api-key">API Key</Label>
                    <Input
                      id="api-key"
                      name="apiKey"
                      type="password"
                      placeholder="Enter API key"
                      defaultValue={config.btcPayApiKey || ""}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Create an API key in BTCPay Server with pull payment
                      permissions
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="pull-payment-id">
                      Shared Pull Payment ID (Optional)
                    </Label>
                    <Input
                      id="pull-payment-id"
                      name="pullPaymentId"
                      type="text"
                      placeholder="abc123def456..."
                      defaultValue={config.pullPaymentId || ""}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Optional: Fallback shared pull payment for when API is not
                      available
                    </p>
                  </div>

                  <Button type="submit" className="w-full">
                    <QrCode className="mr-2 h-4 w-4" />
                    Save Pull Payment Configuration
                  </Button>
                </form>

                {config.pullPaymentId && (
                  <div className="pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (
                          confirm(
                            "Are you sure you want to remove pull payment configuration?"
                          )
                        ) {
                          await updateConfig({
                            pullPaymentId: undefined,
                            btcPayServerUrl: undefined,
                            btcPayStoreId: undefined,
                            btcPayApiKey: undefined,
                          });
                        }
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove Configuration
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admins">
            <Card>
              <CardHeader>
                <CardTitle>Admin Management</CardTitle>
                <CardDescription>
                  Manage admin access to the game wallet
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>Current Admins</Label>
                    <div className="mt-2 space-y-2">
                      {config.adminPubkeys.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No admins configured
                        </p>
                      ) : (
                        config.adminPubkeys.map((pubkey) => (
                          <div
                            key={pubkey}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded"
                          >
                            <code className="text-xs">
                              {pubkey.slice(0, 16)}...{pubkey.slice(-8)}
                            </code>
                            {pubkey === user.pubkey && (
                              <Badge variant="secondary">You</Badge>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      To add or remove admins, use the game wallet CLI or contact
                      the system administrator.
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="games">
            <Card>
              <CardHeader>
                <CardTitle>Game Management</CardTitle>
                <CardDescription>
                  Control which games are available to users
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border border-amber-200 hover:border-primary/30 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Coins className="h-5 w-5 text-primary" />
                        <h4 className="font-medium">Satoshi Stacker</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        A clicker game where users can stack sats and earn real
                        Bitcoin rewards through proof of work
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

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Games marked as hidden will not appear in the Bitcoin Education
                    Games section. Only admins can change game visibility settings.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
