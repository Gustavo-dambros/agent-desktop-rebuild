import { ErrorCode } from "./errorCode.js";
import { DeliverySemantics, unknownDelivery, notDeliveredSafe, notDeliveredUnsafe } from "./deliveryDisposition.js";

export interface RecoveryHint {
  strategy: string;
  retryable: boolean;
  requires_fresh_snapshot: boolean;
  retry_after_ms?: number;
}

export class AppError extends Error {
  code: ErrorCode;
  suggestion?: string;
  platform_detail?: string;
  details?: unknown;
  disposition: DeliverySemantics;
  recovery?: RecoveryHint;

  constructor(code: ErrorCode, message: string, opts?: {
    suggestion?: string;
    platform_detail?: string;
    details?: unknown;
    disposition?: DeliverySemantics;
    recovery?: RecoveryHint;
  }) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.suggestion = opts?.suggestion;
    this.platform_detail = opts?.platform_detail;
    this.details = opts?.details;
    this.disposition = opts?.disposition ?? unknownDelivery();
    if (opts?.recovery) this.recovery = opts.recovery;
  }

  static invalidInput(message: string, suggestion?: string): AppError {
    return new AppError(ErrorCode.InvalidArgs, message, { suggestion, disposition: notDeliveredSafe() });
  }

  static invalidInputWithSuggestion(message: string, suggestion: string): AppError {
    return AppError.invalidInput(message, suggestion);
  }

  static notSupported(message: string, suggestion?: string): AppError {
    return new AppError(ErrorCode.PlatformNotSupported, message, { suggestion, disposition: notDeliveredSafe() });
  }

  static staleRef(message: string, details?: unknown): AppError {
    return new AppError(ErrorCode.StaleRef, message, {
      suggestion: "Take a new snapshot and use its refs.",
      details,
      disposition: notDeliveredSafe(),
      recovery: { strategy: "refresh_snapshot_then_retry_original", retryable: true, requires_fresh_snapshot: true },
    });
  }

  static ambiguous(message: string, details?: unknown): AppError {
    return new AppError(ErrorCode.AmbiguousTarget, message, {
      suggestion: "Refine the target (e.g. pass --window-id) or take a new snapshot.",
      details,
      disposition: notDeliveredSafe(),
    });
  }

  static notFound(code: ErrorCode, message: string, suggestion?: string): AppError {
    return new AppError(code, message, { suggestion, disposition: notDeliveredSafe() });
  }

  static actionFailed(message: string, disposition: DeliverySemantics = notDeliveredUnsafe(), details?: unknown): AppError {
    return new AppError(ErrorCode.ActionFailed, message, { disposition, details });
  }

  static internal(message: string): AppError {
    return new AppError(ErrorCode.Internal, message, { disposition: unknownDelivery() });
  }
}
