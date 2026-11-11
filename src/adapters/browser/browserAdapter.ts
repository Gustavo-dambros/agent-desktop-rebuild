import { WebSocket } from "ws";
import http from "node:http";
import { AppError } from "../../core/response/appError.js";
import { ErrorCode } from "../../core/response/errorCode.js";
import { PlatformAdapter, SnapshotResult, SnapshotTarget, TreeOptions, Node } from "../../core/adapter/types.js";
import { generateSnapshotId, saveRefMap } from "../../core/refs/refStore.js";

interface CDPTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl: string;
}

async function httpGetJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (c) => data += c);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

class CDPClient {
  private ws: WebSocket;
  private id = 0;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();
  constructor(ws: WebSocket) {
    this.ws = ws;
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message || "CDP error"));
        else p.resolve(msg.result);
      }
    });
  }
  static async connect(wsUrl: string): Promise<CDPClient> {
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    return new CDPClient(ws);
  }
  send(method: string, params: any = {}): Promise<any> {
    const id = ++this.id;
    const msg = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(msg, (err) => { if (err) { this.pending.delete(id); reject(err); } });
    });
  }
  close() { try { this.ws.close(); } catch {} }
}

const INTERACTIVE_ROLES = new Set([
  "button","link","textbox","checkbox","radio","combobox","listbox","menuitem","menuitemcheckbox","menuitemradio",
  "tab","switch","slider","spinbutton","searchbox","option","treeitem","gridcell","cell","row","columnheader",
  "rowheader","link","pushbutton","EditableText","StaticText" // include some raw roles
]);

export class BrowserAdapter implements PlatformAdapter {
  private port: number;
  private targetUrl?: string;
  constructor(port = 9222) { this.port = port; }

  name() { return "browser-chrome-cdp"; }

  checkSurfaceSupport(surface: string): void {
    if (surface && surface !== "window") {
      // browser exposes page; allow window/menu-like? keep permissive
    }
  }

  private async getTarget(preferred?: string): Promise<CDPTarget> {
    const list: CDPTarget[] = await httpGetJson(`http://127.0.0.1:${this.port}/json`);
    const pages = list.filter(t => t.type === "page" && t.webSocketDebuggerUrl);
    if (pages.length === 0) {
      throw new AppError(ErrorCode.AppNotFound, "No Chrome page target found", {
        suggestion: `Start Chrome with --remote-debugging-port=${this.port} and open a page.`,
        disposition: { delivery: "not_delivered", retry: "safe" },
      });
    }
    if (preferred) {
      const byTitle = pages.find(p => p.title.includes(preferred) || p.url.includes(preferred));
      if (byTitle) return byTitle;
    }
    return pages[0];
  }

  async snapshot(target: SnapshotTarget, opts: TreeOptions, _ctx: any): Promise<SnapshotResult> {
    const t = await this.getTarget(target.appName || target.windowId);
    const client = await CDPClient.connect(t.webSocketDebuggerUrl);
    try {
      await client.send("Accessibility.enable").catch(() => {});
      await client.send("DOM.enable").catch(() => {});
      await client.send("Runtime.enable").catch(() => {});
      const ax = await client.send("Accessibility.getFullAXTree", {});
      const nodesAx: any[] = ax.nodes || [];
      const byId = new Map<string, any>();
      for (const n of nodesAx) byId.set(n.nodeId, n);
      // find root
      let rootAx = nodesAx.find(n => !n.parentId) || nodesAx[0];
      const snapshotId = generateSnapshotId();
      const refmap: Record<string, any> = {};
      let counter = 0;
      let refCount = 0;

      const getName = (n: any): string | undefined => {
        const v = n.name?.value; if (v != null && String(v).trim()) return String(v);
        return undefined;
      };
      const getRole = (n: any): string => {
        const r = n.role?.value; return r ? String(r) : "unknown";
      };
      const isInteractive = (role: string, n: any) => {
        const rl = role.toLowerCase();
        if (INTERACTIVE_ROLES.has(rl) || INTERACTIVE_ROLES.has(role)) return true;
        if (n.focusable?.value) return true;
        return false;
      };

      const build = (nodeId: string, depth: number): Node | null => {
        const n = byId.get(nodeId);
        if (!n) return null;
        if (n.ignored?.value) {
          // skip ignored but traverse children
        }
        const role = getRole(n);
        const ignored = !!n.ignored?.value;
        if (ignored) {
          // merge children up? simple: process children and return first? better return null but caller handles
        }
        const name = getName(n);
        let node: Node = { role, name };
        if (n.description?.value) node.description = String(n.description.value);
        if (n.value?.value != null) node.value = String(n.value.value);
        const interactive = isInteractive(role, n);
        if (interactive && !ignored) {
          counter += 1;
          const elementId = `@e${counter}`;
          const qualified = `@${snapshotId}:${elementId.slice(1)}`;
          node.ref_id = qualified;
          node.available_actions = ["Click", "Focus"];
          if (["textbox","searchbox","combobox","EditableText"].includes(role) || n.editable) node.available_actions.push("Type","SetValue","Clear");
          if (["checkbox","switch","menuitemcheckbox"].includes(role)) node.available_actions.push("Toggle","Check","Uncheck");
          refCount += 1;
          refmap[elementId] = {
            role, name, description: node.description, value: node.value,
            backend_id: n.backendDOMNodeId, ax_node_id: n.nodeId,
            actions: node.available_actions,
          };
        }
        if (opts.interactiveOnly && !interactive && !ignored) {
          // but may have interactive descendants; handle below
        }
        let children: Node[] = [];
        if (depth < opts.maxDepth) {
          const childIds: string[] = n.childIds || [];
          for (const cid of childIds) {
            const c = build(cid, depth + 1);
            if (c) children.push(c);
          }
        }
        if (children.length) node.children = children;

        if (opts.interactiveOnly && !interactive && !ignored) {
          // if no ref and no interactive descendants, drop
          const hasInteractiveDesc = (nd: Node): boolean => !!nd.ref_id || (nd.children||[]).some(hasInteractiveDesc);
          if (!hasInteractiveDesc(node)) return null;
          // if single child chain without own ref, can collapse - keep simple
        }
        if (ignored) {
          // return children inlined? simplify: if one child return it else null
          if (children.length === 1) return children[0];
          if (children.length > 1) return { role: "generic", children };
          return null;
        }
        return node;
      };

      const tree = build(rootAx.nodeId, 0) || { role: "RootWebArea", name: t.title, children: [] };
      const result: SnapshotResult = {
        app: target.appName || t.title || "Chrome",
        window: { id: t.id, title: t.title },
        snapshot_id: snapshotId,
        ref_count: refCount,
        complete: true,
        tree,
        refmap,
      };
      saveRefMap({
        snapshot_id: snapshotId,
        app: result.app,
        window: result.window,
        refs: refmap,
        tree,
        created_at: new Date().toISOString(),
      }, undefined);
      return result;
    } finally {
      client.close();
    }
  }

  async click(refQualified: string, _ctx: any): Promise<any> {
    return this.performOnRef(refQualified, "click");
  }
  async focus(refQualified: string, _ctx: any): Promise<any> {
    return this.performOnRef(refQualified, "focus");
  }
  async typeText(refQualified: string, text: string, _ctx: any): Promise<any> {
    return this.performOnRef(refQualified, "type", { text });
  }
  async setValue(refQualified: string, value: string, _ctx: any): Promise<any> {
    return this.performOnRef(refQualified, "setValue", { value });
  }
  async clear(refQualified: string, _ctx: any): Promise<any> {
    return this.performOnRef(refQualified, "clear");
  }

  private async performOnRef(refQualified: string, action: string, extra: any = {}): Promise<any> {
    const { resolveQualifiedRef } = await import("../../core/refs/refStore.js");
    const resolved = resolveQualifiedRef(refQualified);
    const backendId = resolved.entry.backend_id as number | undefined;
    if (!backendId) throw AppError.staleRef(`Ref ${refQualified} has no backend node id`);
    const t = await this.getTarget();
    const client = await CDPClient.connect(t.webSocketDebuggerUrl);
    try {
      await client.send("DOM.enable").catch(()=>{});
      await client.send("Runtime.enable").catch(()=>{});
      const { object } = await client.send("DOM.resolveNode", { backendNodeId: backendId });
      const objectId = object?.objectId;
      if (!objectId) throw AppError.staleRef(`Could not resolve DOM node for ${refQualified}`);
      if (action === "click") {
        await client.send("Runtime.callFunctionOn", { objectId, functionDeclaration: "function(){ this.scrollIntoViewIfNeeded(); this.click(); }" });
      } else if (action === "focus") {
        await client.send("Runtime.callFunctionOn", { objectId, functionDeclaration: "function(){ this.focus(); }" });
      } else if (action === "type") {
        const text = String(extra.text ?? "");
        await client.send("Runtime.callFunctionOn", { objectId, functionDeclaration: "function(){ this.focus(); }" });
        await client.send("Input.insertText", { text });
      } else if (action === "setValue") {
        const value = String(extra.value ?? "");
        await client.send("Runtime.callFunctionOn", { objectId, functionDeclaration: `function(v){ this.focus(); if('value' in this){ this.value = v; this.dispatchEvent(new Event('input',{bubbles:true})); this.dispatchEvent(new Event('change',{bubbles:true})); } else { this.textContent = v; } }`, arguments: [{ value }] });
      } else if (action === "clear") {
        await client.send("Runtime.callFunctionOn", { objectId, functionDeclaration: "function(){ this.focus(); if('value' in this){ this.value=''; this.dispatchEvent(new Event('input',{bubbles:true})); this.dispatchEvent(new Event('change',{bubbles:true})); } else { this.textContent=''; } }" });
      }
      return { ref: refQualified, action, delivered: "delivered_unverified" };
    } finally {
      client.close();
    }
  }
}
