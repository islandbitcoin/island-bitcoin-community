import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";

interface HealthCheck {
  name: string;
  status: "checking" | "healthy" | "unhealthy" | "warning";
  message: string;
  latency?: number;
}

const SITE_NAME = "Island Bitcoin";

export default function Health() {
  const [checks, setChecks] = useState<HealthCheck[]>([
    { name: "Application", status: "checking", message: "Checking..." },
    { name: "Local Storage", status: "checking", message: "Checking..." },
    { name: "Network", status: "checking", message: "Checking..." },
  ]);

  useEffect(() => {
    const runHealthChecks = async () => {
      const newChecks: HealthCheck[] = [];

      newChecks.push({
        name: "Application",
        status: "healthy",
        message: `Version: ${import.meta.env.VITE_APP_VERSION || "1.0.0"}`,
      });

      try {
        const testKey = "health-check-test";
        localStorage.setItem(testKey, "test");
        const value = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);

        if (value === "test") {
          const usage = JSON.stringify(localStorage).length;
          newChecks.push({
            name: "Local Storage",
            status: "healthy",
            message: `Available and working (${(usage / 1024).toFixed(1)}KB used)`,
          });
        } else {
          throw new Error("Read/write test failed");
        }
      } catch (error) {
        newChecks.push({
          name: "Local Storage",
          status: "unhealthy",
          message: `Storage error: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }

      try {
        const start = Date.now();
        const response = await fetch("/", { method: "HEAD" });
        const latency = Date.now() - start;

        newChecks.push({
          name: "Network",
          status: response.ok ? "healthy" : "warning",
          message: response.ok ? "Connected" : "Connection issues",
          latency,
        });
      } catch {
        newChecks.push({
          name: "Network",
          status: "warning",
          message: "Unable to verify network connectivity",
        });
      }

      setChecks(newChecks);
    };

    runHealthChecks();

    const interval = setInterval(runHealthChecks, 30000);

    return () => clearInterval(interval);
  }, []);

  const overallStatus = checks.every((c) => c.status === "healthy")
    ? "healthy"
    : checks.some((c) => c.status === "unhealthy")
      ? "unhealthy"
      : checks.some((c) => c.status === "checking")
        ? "checking"
        : "warning";

  const getStatusIcon = (status: HealthCheck["status"]) => {
    switch (status) {
      case "checking":
        return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
      case "healthy":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case "unhealthy":
        return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusBadge = (status: HealthCheck["status"]) => {
    const styles = {
      checking: "bg-secondary text-secondary-foreground",
      healthy: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
      warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
      unhealthy: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
    };

    const labels = {
      checking: "Checking",
      healthy: "Healthy",
      warning: "Warning",
      unhealthy: "Unhealthy",
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (window.location.search.includes("format=json")) {
    return (
      <pre className="p-4">
        {JSON.stringify(
          {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            checks: checks.map((c) => ({
              name: c.name,
              status: c.status,
              message: c.message,
              latency: c.latency,
            })),
          },
          null,
          2
        )}
      </pre>
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

        <div className="container mx-auto px-4 max-w-4xl py-16">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <h1>System Health</h1>
                {getStatusBadge(overallStatus)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {checks.map((check) => (
                  <div
                    key={check.name}
                    className="flex items-start space-x-3 p-4 rounded-lg bg-muted/50"
                  >
                    {getStatusIcon(check.status)}
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h3 className="font-medium">{check.name}</h3>
                        {check.latency !== undefined && (
                          <span className="ml-2 text-sm text-muted-foreground">
                            ({check.latency}ms)
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {check.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-primary/5 rounded-lg">
                <p className="text-sm text-primary">
                  <strong>API Endpoint:</strong> <code>/health?format=json</code>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Use this endpoint for automated monitoring and alerts.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
