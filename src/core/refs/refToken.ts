import { AppError } from "../response/appError.js";

export const QUALIFIED_REF_RE = /^@s([a-z0-9]+):e(\d+)$/;
export const BARE_REF_RE = /^@e\d+$/;

export interface ParsedRef {
  raw: string;
  snapshotId: string;
  elementId: string; // @eN
  qualified: string; // @s..:eN
}

export function validateRefToken(refId: string): void {
  if (BARE_REF_RE.test(refId)) {
    throw AppError.invalidInputWithSuggestion(
      `Bare ref '${refId}' is rejected; refs are snapshot-qualified.`,
      "Use the qualified ref from the snapshot, e.g. @s8f3k2p9:e8."
    );
  }
  if (!QUALIFIED_REF_RE.test(refId)) {
    throw AppError.invalidInput(`Invalid ref id '${refId}'`, "Expected a qualified ref like @s8f3k2p9:e8.");
  }
}

export function parseRef(refId: string): ParsedRef {
  validateRefToken(refId);
  const m = QUALIFIED_REF_RE.exec(refId)!;
  const snapshotId = "s" + m[1];
  const elementId = "@e" + m[2];
  return { raw: refId, snapshotId, elementId, qualified: `@${snapshotId.slice(1)}:${elementId.slice(1)}`.replace("@s", "@s") };
}

export function snapshotIdFromQualified(refId: string): string {
  const p = parseRef(refId);
  return p.snapshotId;
}
