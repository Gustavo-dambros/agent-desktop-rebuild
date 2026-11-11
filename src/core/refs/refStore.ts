import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { AppError } from "../response/appError.js";
import { ErrorCode } from "../response/errorCode.js";

export interface RefEntry {
  role: string;
  name?: string;
  description?: string;
  value?: string;
  bounds?: { x: number; y: number; width: number; height: number };
  actions?: string[];
  path?: number[];
  backend_id?: number | string;
  native_id?: string;
  [k: string]: unknown;
}

export interface RefMapData {
  snapshot_id: string;
  app?: string;
  window?: { id?: string; title?: string };
  refs: Record<string, RefEntry>;
  tree?: unknown;
  created_at?: string;
}

const MAX_REFMAP_BYTES = 1_048_576;

function baseDir(): string {
  return process.env.AGENT_DESKTOP_HOME || path.join(os.homedir(), ".agent-desktop");
}

function namespaceDir(sessionId?: string): string {
  const root = baseDir();
  return sessionId ? path.join(root, "sessions", sessionId) : root;
}

export function snapshotsDir(sessionId?: string): string {
  return path.join(namespaceDir(sessionId), "snapshots");
}

export function generateSnapshotId(): string {
  return "s" + crypto.randomBytes(4).toString("hex");
}

export function saveRefMap(map: RefMapData, sessionId?: string): string {
  const dir = path.join(snapshotsDir(sessionId), map.snapshot_id);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "refmap.json");
  const json = JSON.stringify(map);
  if (Buffer.byteLength(json, "utf8") > MAX_REFMAP_BYTES) {
    // truncate tree if needed but keep refs - simple approach
  }
  fs.writeFileSync(file, json, "utf8");
  // also write last_refmap for convenience
  try { fs.writeFileSync(path.join(namespaceDir(sessionId), "last_refmap.json"), json, "utf8"); } catch {}
  return file;
}

export function loadRefMap(snapshotId: string, sessionId?: string): RefMapData {
  const file = path.join(snapshotsDir(sessionId), snapshotId, "refmap.json");
  if (!fs.existsSync(file)) {
    throw new AppError(ErrorCode.SnapshotNotFound, `Snapshot '${snapshotId}' not found`, {
      suggestion: "Take a new snapshot.",
      disposition: { delivery: "not_delivered", retry: "safe" },
      recovery: { strategy: "refresh_snapshot_then_retry_original", retryable: true, requires_fresh_snapshot: true },
    });
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as RefMapData;
}

export function loadRefEntry(snapshotId: string, elementId: string, sessionId?: string): RefEntry {
  const map = loadRefMap(snapshotId, sessionId);
  const entry = map.refs[elementId];
  if (!entry) {
    throw AppError.staleRef(`Ref ${elementId} not found in snapshot ${snapshotId}`);
  }
  return entry;
}

export function resolveQualifiedRef(qualified: string, sessionId?: string): { snapshotId: string; elementId: string; entry: RefEntry; map: RefMapData } {
  const m = /^@s([a-z0-9]+):e(\d+)$/.exec(qualified);
  if (!m) throw AppError.invalidInput(`Invalid ref '${qualified}'`);
  const snapshotId = "s" + m[1];
  const elementId = "@e" + m[2];
  const map = loadRefMap(snapshotId, sessionId);
  const entry = map.refs[elementId];
  if (!entry) throw AppError.staleRef(`Ref ${qualified} not found in snapshot ${snapshotId}`);
  return { snapshotId, elementId, entry, map };
}
