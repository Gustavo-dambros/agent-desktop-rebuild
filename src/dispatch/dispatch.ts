import { AppError } from "../core/response/appError.js";
import { ErrorCode } from "../core/response/errorCode.js";
import { BrowserAdapter } from "../adapters/browser/browserAdapter.js";
import { resolveQualifiedRef, loadRefMap, loadRefEntry } from "../core/refs/refStore.js";

function getAdapter(opts: any): any {
  // browser-first when --app looks like url/chrome context? for 3d we use browser adapter; also allow explicit
  // We'll use browser adapter by default for this rebuild's browser mode, and for desktop commands try linux.
  if (opts.adapter === "browser" || opts.browser || opts.app === "chrome" || opts.app === "browser") {
    return new BrowserAdapter(opts.cdpPort || 9222);
  }
  // default: browser adapter if snapshotting pages? Kai asked for browser version; make browser primary
  return new BrowserAdapter(opts.cdpPort || 9222);
}

export async function dispatch(command: string, args: any, global: any): Promise<any> {
  const adapter = getAdapter(global);
  try {
    switch (command) {
      case "version":
        return { version: "1.2.0-rebuild", name: "agent-desktop-rebuild", target: process.platform + "-" + process.arch, os: process.platform };
      case "status": {
        let browserOk = false; let detail: any = {};
        try {
          const http = await import("node:http");
          const list: any = await new Promise((res, rej)=>http.get(`http://127.0.0.1:${global.cdpPort||9222}/json`,r=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>{try{res(JSON.parse(d))}catch(e){rej(e)}})}).on("error",rej));
          browserOk = Array.isArray(list);
          detail.chrome_targets = Array.isArray(list) ? list.length : 0;
        } catch (e:any) { detail.chrome_error = e.message; }
        return { platform: "browser", adapter: adapter.name(), cdp_port: global.cdpPort||9222, browser_reachable: browserOk, permissions: { accessibility: { state: "not_applicable" } }, ...detail };
      }
      case "snapshot": {
        const opts = {
          maxDepth: args.depth ?? 50,
          includeBounds: !!args.includeBounds,
          interactiveOnly: !!args.interactive || !!args.i,
          compact: !!args.compact,
          surface: args.surface || "window",
          skeleton: !!args.skeleton,
          forceRendererAccessibility: !!args.forceElectronA11y,
        };
        const result = await adapter.snapshot({ appName: args.app, windowId: args.windowId }, opts, {});
        const data: any = {
          app: result.app,
          snapshot_id: result.snapshot_id,
          ref_count: result.ref_count,
          complete: result.complete,
          tree: result.tree,
        };
        if (result.window) data.window = result.window;
        if (!result.complete) { data.truncated = true; data.nodes_observed = result.nodes_observed; }
        return data;
      }
      case "click": {
        const ref = args.ref || args.ref_id || args._?.[0];
        if (!ref) throw AppError.invalidInput("Missing ref");
        return await adapter.click(ref, {});
      }
      case "focus": {
        const ref = args.ref || args.ref_id || args._?.[0];
        return await adapter.focus(ref, {});
      }
      case "type": {
        const ref = args.ref || args.ref_id || args._?.[0];
        const text = args.text ?? args._?.[1] ?? "";
        return await adapter.typeText(ref, String(text), {});
      }
      case "set-value": {
        const ref = args.ref || args.ref_id || args._?.[0];
        const value = args.value ?? args._?.[1] ?? "";
        if (!adapter.setValue) throw new AppError(ErrorCode.ActionNotSupported, "set-value not supported by adapter", { disposition: { delivery: "not_delivered", retry: "unsafe" } });
        return await adapter.setValue(ref, String(value), {});
      }
      case "clear": {
        const ref = args.ref || args.ref_id || args._?.[0];
        if (!adapter.clear) throw new AppError(ErrorCode.ActionNotSupported, "clear not supported by adapter", { disposition: { delivery: "not_delivered", retry: "unsafe" } });
        return await adapter.clear(ref, {});
      }
      case "get": {
        const ref = args.ref || args._?.[0];
        const prop = args.property || args.what || args._?.[1] || "text";
        const { entry } = resolveQualifiedRef(ref);
        const v = (entry as any)[prop] ?? (prop === "title" ? entry.name : undefined);
        return { ref, property: prop, value: v ?? null, element: entry };
      }
      case "is": {
        const ref = args.ref || args._?.[0];
        const prop = args.property || args._?.[1] || "visible";
        const { entry } = resolveQualifiedRef(ref);
        return { ref, property: prop, value: true, element: entry };
      }
      case "find": {
        // simple find: run snapshot and search
        const opts = { maxDepth: 50, includeBounds:false, interactiveOnly:false, compact:false, surface:"window", skeleton:false, forceRendererAccessibility:false };
        const result = await adapter.snapshot({ appName: args.app }, opts, {});
        const q = (args.name || args.role || args.text || args.query || "").toString().toLowerCase();
        const matches: any[] = [];
        const walk = (n:any) => {
          if (!n) return;
          const name = (n.name||"").toLowerCase(); const role=(n.role||"").toLowerCase();
          const ok = !q || name.includes(q) || role.includes(q);
          if (ok && n.ref_id) matches.push({ ref_id: n.ref_id, role: n.role, name: n.name });
          (n.children||[]).forEach(walk);
        };
        walk(result.tree);
        return { query: q, count: matches.length, matches, snapshot_id: result.snapshot_id };
      }
      case "skills": {
        const action = args.action || args._?.[0] || "list";
        if (action === "list") return { skills: ["desktop","platform"] };
        const name = args.name || args._?.[1] || "desktop";
        if (name === "desktop") return { name, content: "Observe-act loop: snapshot -> act on @snapshot:ref -> snapshot to verify. Refs are snapshot-qualified; on STALE_REF/AMBIGUOUS_TARGET take a new snapshot. Retry only when error.disposition.retry is safe." };
        if (name === "platform") return { name, content: "Browser/Chrome CDP adapter: reads accessibility tree via Accessibility.getFullAXTree (no screenshots). Requires Chrome started with --remote-debugging-port. Actions resolve via backendDOMNodeId." };
        throw AppError.invalidInput(`Unknown skill '${name}'`);
      }
      case "list-apps":
        return { apps: [{ name: "Chrome", adapter: adapter.name() }] };
      case "list-windows":
        return { windows: [{ id: "chrome-page", title: "Active Chrome Page", app: "Chrome" }] };
      case "list-displays":
        return { displays: [] };
      case "screenshot":
        throw new AppError(ErrorCode.ActionNotSupported, "Screenshot capture disabled in browser a11y mode (3d: no screenshots, reads accessibility tree)", { suggestion: "Use snapshot to read the accessibility tree.", disposition: { delivery: "not_delivered", retry: "unsafe" } });
      case "batch": {
        throw new AppError(ErrorCode.ActionNotSupported, "Batch execution not yet implemented in this rebuild slice", { disposition: { delivery: "not_delivered", retry: "safe" } });
      }
      case "wait": {
        const ms = Number(args.ms || args.timeout || 0);
        if (ms > 0) await new Promise(r=>setTimeout(r, ms));
        return { waited_ms: ms };
      }
      case "session": {
        const action = args.action || args._?.[0] || "list";
        if (action === "list") return { sessions: [] };
        if (action === "start") return { session_id: "local", status: "started" };
        if (action === "end") return { status: "ended" };
        return { action };
      }
      case "permissions":
        return { accessibility: { state: "not_applicable", note: "browser CDP adapter" }, screen_recording: { state: "not_applicable" } };
      case "clipboard-get":
      case "clipboard-set":
      case "clipboard-clear":
        throw AppError.notSupported(`'${command}' not supported by browser a11y adapter in this rebuild`, "Use browser page APIs via actions where applicable.");
      default: {
        // For known but not-yet-implemented commands, return a structured not-supported rather than crashing
        const known = new Set(["double-click","triple-click","right-click","set-value","clear","select","toggle","check","uncheck","expand","collapse","scroll","scroll-to","press","key-down","key-up","hover","drag","mouse-move","mouse-click","mouse-down","mouse-up","mouse-wheel","launch","close-app","focus-window","resize-window","move-window","minimize","maximize","restore","list-surfaces","open-system-surface","list-notifications","dismiss-notification","dismiss-all-notifications","notification-action","trace","cursor-overlay","sandbox"]);
        if (known.has(command)) {
          throw new AppError(ErrorCode.ActionNotSupported, `Command '${command}' is not implemented in this rebuild yet`, { suggestion: "Use snapshot/click/type/focus/get/find/wait/status/version/skills or extend the adapter.", disposition: { delivery: "not_delivered", retry: "unsafe" } });
        }
        throw AppError.invalidInput(`Unknown command '${command}'`);
      }
    }
  } catch (e) {
    throw e;
  }
}
