import { AppError, RecoveryHint } from "./appError.js";
import { DeliverySemantics } from "./deliveryDisposition.js";
import { ErrorCode } from "./errorCode.js";

export const ENVELOPE_VERSION = "2.6";

export interface ErrorPayload {
  code: string;
  message: string;
  suggestion?: string;
  recovery?: RecoveryHint;
  platform_detail?: string;
  details?: unknown;
  disposition: DeliverySemantics;
}

export interface ResponseEnvelope {
  version: string;
  ok: boolean;
  command: string;
  data?: unknown;
  error?: ErrorPayload;
}

export function ok(command: string, data: unknown): ResponseEnvelope {
  return { version: ENVELOPE_VERSION, ok: true, command, data };
}

export function err(command: string, payload: ErrorPayload): ResponseEnvelope {
  return { version: ENVELOPE_VERSION, ok: false, command, error: payload };
}

function recoveryFor(code: ErrorCode, disposition: DeliverySemantics, details?: any): RecoveryHint | undefined {
  if (disposition.retry !== "safe") return undefined;
  const processExited = details && details.process_state === "exited";
  switch (code) {
    case ErrorCode.StaleRef:
      if (processExited) return { strategy: "inspect_state_then_retry_original", retryable: true, requires_fresh_snapshot: true };
      return { strategy: "refresh_snapshot_then_retry_original", retryable: true, requires_fresh_snapshot: true };
    case ErrorCode.SnapshotNotFound:
      return { strategy: "refresh_snapshot_then_retry_original", retryable: true, requires_fresh_snapshot: true };
    case ErrorCode.PolicyDenied:
      return { strategy: "request_explicit_policy_then_retry_original", retryable: true, requires_fresh_snapshot: false };
    case ErrorCode.AppUnresponsive:
    case ErrorCode.Timeout:
      return { strategy: "inspect_state_then_retry_original", retryable: true, requires_fresh_snapshot: true, retry_after_ms: 250 };
    default:
      return undefined;
  }
}

export function fromAppError(e: AppError): ErrorPayload {
  const payload: ErrorPayload = {
    code: e.code,
    message: e.message,
    disposition: e.disposition,
  };
  if (e.suggestion) payload.suggestion = e.suggestion;
  if (e.platform_detail) payload.platform_detail = e.platform_detail;
  if (e.details !== undefined) payload.details = e.details;
  payload.recovery = e.recovery ?? recoveryFor(e.code, e.disposition, e.details);
  return payload;
}

export function envelopeForError(command: string, error: unknown): ResponseEnvelope {
  if (error instanceof AppError) return err(command, fromAppError(error));
  const msg = error instanceof Error ? error.message : String(error);
  const internal = AppError.internal(msg);
  return err(command, fromAppError(internal));
}
