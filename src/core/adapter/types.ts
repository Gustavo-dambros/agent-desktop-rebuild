export interface TreeOptions {
  maxDepth: number;
  includeBounds: boolean;
  interactiveOnly: boolean;
  compact: boolean;
  surface: string;
  skeleton: boolean;
  forceRendererAccessibility: boolean;
}

export interface SnapshotTarget {
  appName?: string;
  windowId?: string;
}

export interface Node {
  role: string;
  name?: string;
  description?: string;
  value?: string;
  ref_id?: string;
  available_actions?: string[];
  children?: Node[];
  bounds?: { x: number; y: number; width: number; height: number };
  states?: string[];
  [k: string]: unknown;
}

export interface SnapshotResult {
  app: string;
  window?: { id: string; title: string };
  snapshot_id: string;
  ref_count: number;
  complete: boolean;
  truncated?: boolean;
  nodes_observed?: number;
  tree: Node;
  refmap: Record<string, any>;
}

export interface PlatformAdapter {
  name(): string;
  checkSurfaceSupport(surface: string): void;
  snapshot(target: SnapshotTarget, opts: TreeOptions, ctx: any): Promise<SnapshotResult>;
  // actions by ref/selector - simplified interface, implementations can extend
  [k: string]: any;
}
