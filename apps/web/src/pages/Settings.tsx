import { Link } from "react-router-dom";
import { ArrowLeft, Bell, Moon, Palette, Shield, Sun, User } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { LoginButton } from "@/components/auth/LoginButton";
import { UserProfile } from "@/components/auth/UserProfile";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTheme } from "@/hooks/useTheme";

const SITE_NAME = "Island Bitcoin";

export default function Settings() {
  const { user, metadata } = useCurrentUser();
  const { theme, setTheme } = useTheme();

  if (!user) {
    return (
      <Layout hideHeader hideFooter>
        <div className="min-h-screen bg-gradient-to-b from-muted via-background to-muted/30 py-16">
          <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50 -mt-16 mb-16">
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <Link
                  to="/"
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                    {SITE_NAME}
                  </span>
                </Link>
                <Link to="/">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-primary text-primary hover:bg-primary/10"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                </Link>
              </div>
            </div>
          </header>

          <div className="container mx-auto px-4">
            <Card className="max-w-md mx-auto border-border">
              <CardHeader>
                <CardTitle>Settings</CardTitle>
                <CardDescription>Sign in to manage your settings</CardDescription>
              </CardHeader>
              <CardContent className="py-8">
                <div className="text-center space-y-4">
                  <User className="h-12 w-12 mx-auto text-primary/50" />
                  <p className="text-muted-foreground">
                    Please sign in to access your settings
                  </p>
                  <LoginButton className="max-w-60 mx-auto" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout hideHeader hideFooter>
      <div className="min-h-screen bg-gradient-to-b from-muted via-background to-muted/30">
        <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link
                to="/"
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  {SITE_NAME}
                </span>
                <img
                  src="https://raw.githubusercontent.com/islandbitcoin/islandbitcoin-community/4cfeb962c33fff5e6f5561c37ddca3c469c25793/gallery/Island%20Bitcoin%20Logo.jpg"
                  alt="Island Bitcoin Logo"
                  className="h-8 w-8 rounded-full"
                />
              </Link>
              <Link to="/">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-primary text-primary hover:bg-primary/10"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 max-w-4xl py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground mt-2">
              Manage your account and preferences
            </p>
          </div>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Profile</span>
              </TabsTrigger>
              <TabsTrigger value="privacy" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Privacy</span>
              </TabsTrigger>
              <TabsTrigger
                value="preferences"
                className="flex items-center gap-2"
              >
                <Palette className="h-4 w-4" />
                <span className="hidden sm:inline">Preferences</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Profile
                  </CardTitle>
                  <CardDescription>
                    Your public profile information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <UserProfile showLogout={false} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Display Name</p>
                    <p className="text-muted-foreground">
                      {metadata?.name || metadata?.display_name || "Not set"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">About</p>
                    <p className="text-muted-foreground">
                      {metadata?.about || "No bio set"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="privacy">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Privacy
                  </CardTitle>
                  <CardDescription>
                    Manage your privacy settings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Privacy settings coming soon...
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preferences">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Preferences
                  </CardTitle>
                  <CardDescription>
                    Customize your Island Bitcoin experience
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Theme</p>
                      <p className="text-sm text-muted-foreground">
                        Choose your preferred color scheme
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={theme === "light" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTheme("light")}
                      >
                        <Sun className="h-4 w-4 mr-2" />
                        Light
                      </Button>
                      <Button
                        variant={theme === "dark" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTheme("dark")}
                      >
                        <Moon className="h-4 w-4 mr-2" />
                        Dark
                      </Button>
                      <Button
                        variant={theme === "system" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTheme("system")}
                      >
                        System
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
