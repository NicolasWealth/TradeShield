import { formatDateTime, formatNumber, titleCase } from "@/lib/format";
import { VerificationBadge } from "@/components/StatusBadge";
import type { CustodyEvent, Organization } from "@/types";

interface Props {
  events: CustodyEvent[];
  organizations: Organization[];
}

export function CustodyTimeline({ events, organizations }: Props) {
  const name = (id: string) => organizations.find((o) => o.organizationId === id)?.name ?? id;

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No custody events recorded yet.</p>;
  }

  return (
    <ol className="relative space-y-4 border-l border-border pl-6">
      {events.map((e, i) => (
        <li
          key={e.eventId}
          className="rail-item relative"
          style={{ animationDelay: `${i * 55}ms` }}
        >
          <span className="absolute -left-[27px] top-1.5 size-2.5 rounded-full border border-primary bg-background" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-sm font-medium text-foreground">
              {titleCase(e.type)}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {e.eventId}
            </span>
            <VerificationBadge status={e.verificationStatus} />
          </div>
          <p className="mt-1 text-sm text-mist-300">
            {name(e.fromOrganization)} → {name(e.toOrganization)}
          </p>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {formatDateTime(e.timestamp)} · {e.location} · {formatNumber(e.quantity)} units
          </p>
        </li>
      ))}
    </ol>
  );
}
