import { AppError } from "../../core/response/appError.js";
import { PlatformAdapter, SnapshotResult, SnapshotTarget, TreeOptions } from "../../core/adapter/types.js";
export class MacosAdapter implements PlatformAdapter {
  name() { return "macos-ax"; }
  checkSurfaceSupport(_s: string): void {}
  async snapshot(_target: SnapshotTarget, _opts: TreeOptions, _ctx: any): Promise<SnapshotResult> {
    throw AppError.notSupported("macOS AX adapter not available on this host", "Run on macOS to use the AX adapter.");
  }
}
