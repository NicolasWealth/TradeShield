import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — TraceShield Recall Intelligence" },
      {
        name: "description",
        content:
          "Sign in to the TraceShield control room to trace batches, custody chains and recall incidents.",
      },
      { property: "og:title", content: "Sign in — TraceShield" },
      {
        property: "og:description",
        content: "Secure access to TraceShield supply-chain recall intelligence.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("ops@traceshield.demo");
  const [password, setPassword] = useState("traceshield");

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <div className="hidden flex-col justify-between border-r border-border bg-sidebar p-10 lg:flex">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          <span className="font-display text-sm font-semibold tracking-wide text-foreground">
            TraceShield
          </span>
        </div>
        <div className="max-w-md">
          <h2 className="font-display text-3xl font-semibold leading-tight text-foreground">
            Know exactly where the batch went — before the recall notice goes out.
          </h2>
          <p className="mt-4 text-sm text-mist-400">
            Custody-level traceability, deterministic exposure scoring and evidence confidence for
            food-safety operations.
          </p>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          MVP · Chain anchoring pending
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <form
          className="w-full max-w-sm space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            signIn(email.trim() || "ops@traceshield.demo");
            navigate({ to: "/dashboard" });
          }}
        >
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">
              Control room access
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Demo session — any credentials sign you into the seeded network.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" className="w-full">
            Enter control room
          </Button>
        </form>
      </div>
    </div>
  );
}
