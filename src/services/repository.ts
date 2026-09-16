/**
 * Data access layer. Reads/writes Cloud Firestore when Firebase is configured,
 * otherwise falls back to a browser-local demo store seeded from demoData.ts.
 * UI components never talk to Firestore directly.
 */
import { COLLECTIONS, getDb, isFirebaseConfigured } from "./firebase";
import { demoBatches, demoEvents, demoIncidents, demoOrganizations } from "./demoData";
import type { Batch, CustodyEvent, Incident, Organization } from "@/types";

export type DataSource = "firestore" | "demo";

/**
 * Used internally to route reads/writes: Firestore is attempted whenever it
 * is configured, regardless of whether it currently holds any data.
 */
export function getDataSource(): DataSource {
  return isFirebaseConfigured() ? "firestore" : "demo";
}

/**
 * Tracks which source most recently *actually served* the data currently on
 * screen — distinct from getDataSource() above. If Firestore is configured
 * but a collection comes back empty, reads silently fall back to the local
 * demo store; this tracker reflects that fallback so the UI never labels
 * demo data as "Firestore".
 */
let resolvedSource: DataSource = "demo";
const resolvedSourceListeners = new Set<() => void>();

function setResolvedSource(next: DataSource) {
  if (resolvedSource === next) return;
  resolvedSource = next;
  resolvedSourceListeners.forEach((listener) => listener());
}

export function getResolvedDataSource(): DataSource {
  return resolvedSource;
}

export function subscribeResolvedDataSource(listener: () => void): () => void {
  resolvedSourceListeners.add(listener);
  return () => resolvedSourceListeners.delete(listener);
}

/* ------------------------------------------------------------------ */
/* Local demo store                                                    */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "traceshield.demo.v1";

interface LocalDb {
  organizations: Organization[];
  batches: Batch[];
  events: CustodyEvent[];
  incidents: Incident[];
}

const seed = (): LocalDb => ({
  organizations: demoOrganizations,
  batches: demoBatches,
  events: demoEvents,
  incidents: demoIncidents,
});

let memory: LocalDb | null = null;

function local(): LocalDb {
  if (memory) return memory;
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        memory = JSON.parse(raw) as LocalDb;
        return memory;
      }
    } catch {
      /* ignore corrupt storage */
    }
  }
  memory = seed();
  persist();
  return memory;
}

function persist() {
  if (typeof window === "undefined" || !memory) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    /* storage unavailable */
  }
}

/** Re-seed the demo network (used by the Settings page). */
export function reseedDemoData() {
  memory = seed();
  persist();
}

/* ------------------------------------------------------------------ */
/* Firestore helpers                                                   */
/* ------------------------------------------------------------------ */

async function fsList<T>(collectionName: string): Promise<T[]> {
  const db = await getDb();
  const { collection, getDocs } = await import("firebase/firestore");
  const snap = await getDocs(collection(db, collectionName));
  return snap.docs.map((d) => d.data() as T);
}

async function fsSet(collectionName: string, id: string, data: unknown) {
  const db = await getDb();
  const { doc, setDoc } = await import("firebase/firestore");
  await setDoc(doc(db, collectionName, id), data as Record<string, unknown>);
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function listOrganizations(): Promise<Organization[]> {
  if (getDataSource() === "firestore") {
    const rows = await fsList<Organization>(COLLECTIONS.organizations);
    setResolvedSource(rows.length ? "firestore" : "demo");
    return rows.length ? rows : local().organizations;
  }
  setResolvedSource("demo");
  return local().organizations;
}

export async function listBatches(): Promise<Batch[]> {
  if (getDataSource() === "firestore") {
    const rows = await fsList<Batch>(COLLECTIONS.batches);
    setResolvedSource(rows.length ? "firestore" : "demo");
    return rows.length ? rows : local().batches;
  }
  setResolvedSource("demo");
  return local().batches;
}

export async function listEvents(): Promise<CustodyEvent[]> {
  if (getDataSource() === "firestore") {
    const rows = await fsList<CustodyEvent>(COLLECTIONS.events);
    setResolvedSource(rows.length ? "firestore" : "demo");
    return rows.length ? rows : local().events;
  }
  setResolvedSource("demo");
  return local().events;
}

export async function listIncidents(): Promise<Incident[]> {
  if (getDataSource() === "firestore") {
    const rows = await fsList<Incident>(COLLECTIONS.incidents);
    setResolvedSource(rows.length ? "firestore" : "demo");
    return rows.length ? rows : local().incidents;
  }
  setResolvedSource("demo");
  return local().incidents;
}

export async function createBatch(batch: Batch): Promise<Batch> {
  if (getDataSource() === "firestore") {
    await fsSet(COLLECTIONS.batches, batch.batchId, batch);
  } else {
    local().batches = [batch, ...local().batches];
    persist();
  }
  return batch;
}

export async function createEvent(event: CustodyEvent): Promise<CustodyEvent> {
  if (getDataSource() === "firestore") {
    await fsSet(COLLECTIONS.events, event.eventId, event);
  } else {
    local().events = [...local().events, event];
    persist();
  }
  return event;
}

export async function createIncident(incident: Incident): Promise<Incident> {
  if (getDataSource() === "firestore") {
    await fsSet(COLLECTIONS.incidents, incident.incidentId, incident);
  } else {
    local().incidents = [incident, ...local().incidents];
    persist();
  }
  return incident;
}
