export enum ErrorCode {
  PermDenied = "PERM_DENIED",
  ElementNotFound = "ELEMENT_NOT_FOUND",
  AppNotFound = "APP_NOT_FOUND",
  ActionFailed = "ACTION_FAILED",
  ActionNotSupported = "ACTION_NOT_SUPPORTED",
  StaleRef = "STALE_REF",
  AmbiguousTarget = "AMBIGUOUS_TARGET",
  WindowNotFound = "WINDOW_NOT_FOUND",
  PlatformNotSupported = "PLATFORM_NOT_SUPPORTED",
  Timeout = "TIMEOUT",
  InvalidArgs = "INVALID_ARGS",
  NotificationNotFound = "NOTIFICATION_NOT_FOUND",
  SnapshotNotFound = "SNAPSHOT_NOT_FOUND",
  SandboxNotFound = "SANDBOX_NOT_FOUND",
  PolicyDenied = "POLICY_DENIED",
  AppUnresponsive = "APP_UNRESPONSIVE",
  Internal = "INTERNAL",
}

export type ErrorCodeValue = `${ErrorCode}`;
