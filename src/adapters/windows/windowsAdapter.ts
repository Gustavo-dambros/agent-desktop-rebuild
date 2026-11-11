import { AppError } from "../../core/response/appError.js";
import { PlatformAdapter, SnapshotResult, SnapshotTarget, TreeOptions } from "../../core/adapter/types.js";
export class WindowsAdapter implements PlatformAdapter {
  name() { return "windows-uia"; }
  checkSurfaceSupport(_s: string): void {}
  async snapshot(_target: SnapshotTarget, _opts: TreeOptions, _ctx: any): Promise<SnapshotResult> {
    throw AppError.notSupported("Windows UIA adapter not available on this host", "Run on Windows to use the UIA adapter.");
  }
}
