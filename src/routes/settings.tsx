import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useResolvedDataSource, useTraceData } from "@/hooks/useTraceData";
import { getDataSource, reseedDemoData } from "@/services/repository";
import { titleCase } from "@/lib/format";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — TraceShield Workspace" },
      {
        name: "description",
        content:
          "Manage the TraceShield workspace: data source, network organizations and the seeded demo network.",
      },
      { property: "og:title", content: "Workspace settings — TraceShield" },
      {
        property: "og:description",
        content: "Data source status, network directory and demo seed controls.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const { organizations } = useTraceData();
  const qc = useQueryClient();
  const configured = getDataSource();
  const resolved = useResolvedDataSource();

  return (
    <AppShell title="Settings" subtitle="Workspace, data source and demo network.">
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="font-display text-sm font-semibold text-foreground">Session</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Signed in as" value={user?.displayName ?? "—"} />
            <Row label="Email" value={user?.email ?? "—"} />
            <Row label="Role" value={user?.role ?? "—"} />
            <Row label="Organization" value={user?.organizationId ?? "—"} />
          </dl>
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="font-display text-sm font-semibold text-foreground">Data source</h2>
          <p className="mt-2 text-sm text-mist-400">
            {configured === "firestore" && resolved === "firestore"
              ? "Connected to Cloud Firestore using the configured environment variables. Data currently on screen is live."
              : configured === "firestore" && resolved === "demo"
                ? "Firebase environment variables are set, but Firestore returned no data — falling back to the seeded demo network so the app stays usable."
                : "Firebase environment variables are not set, so the seeded demo network is served from local storage."}
          </p>
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">
            VITE_FIREBASE_API_KEY · VITE_FIREBASE_PROJECT_ID · VITE_FIREBASE_APP_ID
          </p>
          <Button
            className="mt-4"
            variant="secondary"
            size="sm"
            onClick={() => {
              reseedDemoData();
              qc.invalidateQueries();
              toast.success("Demo network reseeded");
            }}
          >
            Reseed demo network
          </Button>
        </section>

        <section className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
          <h2 className="font-display text-sm font-semibold text-foreground">Network directory</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {organizations.map((o) => (
              <li key={o.organizationId} className="rounded-md border border-border p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {titleCase(o.type)}
                </p>
                <p className="text-sm text-foreground">{o.name}</p>
                <p className="text-xs text-mist-400">{o.location}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono text-xs text-mist-300">{value}</dd>
    </div>
  );
}
