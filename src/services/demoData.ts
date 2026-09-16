/**
 * Demonstration network. Every record is flagged `isDemo: true` so the UI can
 * label it clearly. This is the single source of seed data — never inline
 * records inside components.
 */
import type { Batch, CustodyEvent, Incident, Organization, User } from "@/types";
import { createEventHash } from "./eventHash";

export const DEMO_FLAG = { isDemo: true as const };

export const demoOrganizations: Organization[] = [
  {
    organizationId: "ORG-MFR-A",
    name: "Manufacturer A",
    type: "MANUFACTURER",
    location: "Agbara Plant, Ogun",
    ...DEMO_FLAG,
  },
  {
    organizationId: "ORG-DIST-LAGOS",
    name: "Distributor Lagos",
    type: "DISTRIBUTOR",
    location: "Apapa, Lagos",
    ...DEMO_FLAG,
  },
  {
    organizationId: "ORG-DIST-ABUJA",
    name: "Distributor Abuja",
    type: "DISTRIBUTOR",
    location: "Idu, Abuja",
    ...DEMO_FLAG,
  },
  {
    organizationId: "ORG-WH-IKEJA",
    name: "Cold Store Ikeja",
    type: "WAREHOUSE",
    location: "Ikeja, Lagos",
    ...DEMO_FLAG,
  },
  {
    organizationId: "ORG-WH-WUSE",
    name: "Cold Store Wuse",
    type: "WAREHOUSE",
    location: "Wuse, Abuja",
    ...DEMO_FLAG,
  },
  {
    organizationId: "ORG-RET-IKEJA",
    name: "Retailer Ikeja",
    type: "RETAILER",
    location: "Ikeja, Lagos",
    ...DEMO_FLAG,
  },
  {
    organizationId: "ORG-RET-LEKKI",
    name: "Retailer Lekki",
    type: "RETAILER",
    location: "Lekki, Lagos",
    ...DEMO_FLAG,
  },
  {
    organizationId: "ORG-RET-WUSE",
    name: "Retailer Wuse",
    type: "RETAILER",
    location: "Wuse, Abuja",
    ...DEMO_FLAG,
  },
  {
    organizationId: "ORG-RET-GARKI",
    name: "Retailer Garki",
    type: "RETAILER",
    location: "Garki, Abuja",
    ...DEMO_FLAG,
  },
];

export const demoUsers: User[] = [
  {
    userId: "USR-001",
    email: "ops@traceshield.demo",
    displayName: "D. Adeyemi",
    role: "Safety Ops",
    organizationId: "ORG-MFR-A",
  },
];

const day = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  d.setUTCHours(9, 0, 0, 0);
  return d.toISOString();
};

const hour = (dayOffset: number, h: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(h, 0, 0, 0);
  return d.toISOString();
};

export const demoBatches: Batch[] = [
  {
    batchId: "B-8841",
    productName: "Chilled Poultry — 4.5kg trays",
    quantity: 2400,
    productionDate: day(-6),
    expiryDate: day(8),
    origin: "Agbara Plant, Ogun",
    organizationId: "ORG-MFR-A",
    status: "IN_TRANSIT",
    createdAt: day(-6),
    ...DEMO_FLAG,
  },
  {
    batchId: "B-8790",
    productName: "Pasteurised Milk — 1L packs",
    quantity: 5200,
    productionDate: day(-11),
    expiryDate: day(4),
    origin: "Agbara Plant, Ogun",
    organizationId: "ORG-MFR-A",
    status: "DELIVERED",
    createdAt: day(-11),
    ...DEMO_FLAG,
  },
  {
    batchId: "B-8722",
    productName: "Frozen Fish Fillet — 10kg cartons",
    quantity: 860,
    productionDate: day(-18),
    expiryDate: day(60),
    origin: "Agbara Plant, Ogun",
    organizationId: "ORG-MFR-A",
    status: "DELIVERED",
    createdAt: day(-18),
    ...DEMO_FLAG,
  },
  {
    batchId: "B-8903",
    productName: "Yoghurt Cups — 24 pack",
    quantity: 3100,
    productionDate: day(-2),
    expiryDate: day(19),
    origin: "Agbara Plant, Ogun",
    organizationId: "ORG-MFR-A",
    status: "PRODUCED",
    createdAt: day(-2),
    ...DEMO_FLAG,
  },
  {
    batchId: "B-8655",
    productName: "Chilled Beef — vacuum packs",
    quantity: 1450,
    productionDate: day(-24),
    expiryDate: day(-1),
    origin: "Agbara Plant, Ogun",
    organizationId: "ORG-MFR-A",
    status: "HELD",
    createdAt: day(-24),
    ...DEMO_FLAG,
  },
];

let seq = 0;
const evt = (
  e: Omit<
    CustodyEvent,
    "eventId" | "eventHash" | "blockchainTxHash" | "verificationStatus" | "isDemo"
  >,
): CustodyEvent => {
  const baseEvent = {
    eventId: `EVT-${String(++seq).padStart(4, "0")}`,
    eventHash: "",
    blockchainTxHash: "",
    verificationStatus: "PENDING_INTEGRATION" as const,
    ...e,
    ...DEMO_FLAG,
  };
  return {
    ...baseEvent,
    eventHash: createEventHash(baseEvent),
  };
};

/** Lagos leg: Mfr A -> Distributor Lagos -> Retailer Ikeja / Retailer Lekki */
/** Abuja leg: Mfr A -> Distributor Abuja -> Retailer Wuse / Retailer Garki */
export const demoEvents: CustodyEvent[] = (() => {
  const list: CustodyEvent[] = [];
  const push = (
    batchId: string,
    type: CustodyEvent["type"],
    from: string,
    to: string,
    location: string,
    quantity: number,
    timestamp: string,
  ) => {
    const prev = [...list].reverse().find((e) => e.batchId === batchId) ?? null;
    list.push(
      evt({
        batchId,
        type,
        fromOrganization: from,
        toOrganization: to,
        location,
        quantity,
        timestamp,
        previousEventId: prev ? prev.eventId : null,
      }),
    );
  };

  // B-8841 — Lagos leg, currently in transit
  push("B-8841", "PRODUCED", "ORG-MFR-A", "ORG-MFR-A", "Agbara Plant, Ogun", 2400, hour(-6, 12));
  push("B-8841", "SHIPPED", "ORG-MFR-A", "ORG-DIST-LAGOS", "Apapa, Lagos", 2400, hour(-5, 8));
  push("B-8841", "RECEIVED", "ORG-MFR-A", "ORG-DIST-LAGOS", "Apapa, Lagos", 2400, hour(-5, 13));
  push("B-8841", "STORED", "ORG-DIST-LAGOS", "ORG-WH-IKEJA", "Ikeja, Lagos", 2400, hour(-4, 10));
  push("B-8841", "SHIPPED", "ORG-WH-IKEJA", "ORG-RET-IKEJA", "Ikeja, Lagos", 1400, hour(-1, 14));
  push("B-8841", "SHIPPED", "ORG-WH-IKEJA", "ORG-RET-LEKKI", "Lekki, Lagos", 1000, hour(-1, 16));

  // B-8790 — Abuja leg, delivered
  push("B-8790", "PRODUCED", "ORG-MFR-A", "ORG-MFR-A", "Agbara Plant, Ogun", 5200, hour(-11, 7));
  push("B-8790", "SHIPPED", "ORG-MFR-A", "ORG-DIST-ABUJA", "Idu, Abuja", 5200, hour(-10, 6));
  push("B-8790", "RECEIVED", "ORG-MFR-A", "ORG-DIST-ABUJA", "Idu, Abuja", 5200, hour(-9, 18));
  push("B-8790", "STORED", "ORG-DIST-ABUJA", "ORG-WH-WUSE", "Wuse, Abuja", 5200, hour(-9, 20));
  push("B-8790", "RECEIVED", "ORG-WH-WUSE", "ORG-RET-WUSE", "Wuse, Abuja", 2700, hour(-8, 9));
  push("B-8790", "RECEIVED", "ORG-WH-WUSE", "ORG-RET-GARKI", "Garki, Abuja", 2500, hour(-8, 11));
  push("B-8790", "INSPECTED", "ORG-RET-WUSE", "ORG-RET-WUSE", "Wuse, Abuja", 2700, hour(-2, 10));

  // B-8722 — both legs, delivered
  push("B-8722", "PRODUCED", "ORG-MFR-A", "ORG-MFR-A", "Agbara Plant, Ogun", 860, hour(-18, 7));
  push("B-8722", "SHIPPED", "ORG-MFR-A", "ORG-DIST-LAGOS", "Apapa, Lagos", 460, hour(-17, 9));
  push("B-8722", "SHIPPED", "ORG-MFR-A", "ORG-DIST-ABUJA", "Idu, Abuja", 400, hour(-17, 11));
  push("B-8722", "RECEIVED", "ORG-DIST-LAGOS", "ORG-RET-LEKKI", "Lekki, Lagos", 460, hour(-15, 12));
  push("B-8722", "RECEIVED", "ORG-DIST-ABUJA", "ORG-RET-GARKI", "Garki, Abuja", 400, hour(-15, 15));

  // B-8903 — produced only
  push("B-8903", "PRODUCED", "ORG-MFR-A", "ORG-MFR-A", "Agbara Plant, Ogun", 3100, hour(-2, 8));

  // B-8655 — held at warehouse
  push("B-8655", "PRODUCED", "ORG-MFR-A", "ORG-MFR-A", "Agbara Plant, Ogun", 1450, hour(-24, 7));
  push("B-8655", "SHIPPED", "ORG-MFR-A", "ORG-DIST-LAGOS", "Apapa, Lagos", 1450, hour(-23, 8));
  push("B-8655", "STORED", "ORG-DIST-LAGOS", "ORG-WH-IKEJA", "Ikeja, Lagos", 1450, hour(-22, 9));

  return list;
})();

export const demoIncidents: Incident[] = [
  {
    incidentId: "INC-2041",
    batchId: "B-8841",
    type: "CONTAMINATION",
    description:
      "Listeria monocytogenes detected in two retained samples from the chilled poultry line. Positive lab result confirmed by the accredited reference laboratory.",
    status: "OPEN",
    createdAt: hour(-1, 9),
    createdBy: "USR-001",
    ...DEMO_FLAG,
  },
  {
    incidentId: "INC-2039",
    batchId: "B-8790",
    type: "COLD_CHAIN_BREAK",
    description:
      "Telemetry shows 9.4°C for 40 minutes in transit between Idu and Wuse. Sensor calibration record is missing for the affected trailer.",
    status: "INVESTIGATING",
    createdAt: hour(-3, 15),
    createdBy: "USR-001",
    ...DEMO_FLAG,
  },
  {
    incidentId: "INC-2036",
    batchId: "B-8722",
    type: "LABELLING",
    description:
      "Expiry date reprinted at the distributor without an approved rework record. Product identity and safety not implicated so far.",
    status: "OPEN",
    createdAt: hour(-6, 11),
    createdBy: "USR-001",
    ...DEMO_FLAG,
  },
];
