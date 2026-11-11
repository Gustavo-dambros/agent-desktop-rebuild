import { AppError } from "../../core/response/appError.js";
import { PlatformAdapter, SnapshotResult, SnapshotTarget, TreeOptions } from "../../core/adapter/types.js";
export class LinuxAdapter implements PlatformAdapter {
  name() { return "linux-atspi"; }
  checkSurfaceSupport(_s: string): void {}
  async snapshot(_target: SnapshotTarget, _opts: TreeOptions, _ctx: any): Promise<SnapshotResult> {
    throw AppError.notSupported("Linux AT-SPI desktop snapshot not fully implemented in this rebuild host pass", "Use the browser/Chrome CDP adapter (3d) or run on a host with AT-SPI bindings wired.");
  }
}
