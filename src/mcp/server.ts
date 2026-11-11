import { dispatch } from "../dispatch/dispatch.js";
import { ok, envelopeForError } from "../core/response/output.js";
import readline from "node:readline";

type RpcReq = { jsonrpc?: string; id?: any; method?: string; params?: any };

function send(obj: any) { process.stdout.write(JSON.stringify(obj) + "\n"); }

const TOOLS = [
  "snapshot","find","screenshot","get","is","click","double-click","triple-click","right-click","type","set-value","clear","focus","select","toggle","check","uncheck","expand","collapse","scroll","scroll-to","press","key-down","key-up","hover","drag","mouse-move","mouse-click","mouse-down","mouse-up","mouse-wheel","launch","close-app","list-windows","list-displays","list-apps","focus-window","resize-window","move-window","minimize","maximize","restore","list-surfaces","open-system-surface","list-notifications","dismiss-notification","dismiss-all-notifications","notification-action","clipboard-get","clipboard-set","clipboard-clear","wait","status","permissions","version","batch","skills","session","cursor-overlay","trace","sandbox"
].map(name => ({
  name: `desktop_${name.replace(/-/g, "_")}`,
  description: `Run agent-desktop command '${name}'`,
  inputSchema: { type: "object", properties: {}, additionalProperties: true },
  _cmd: name,
}));

export async function serveMcp(globals: any) {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on("line", async (line) => {
    if (!line.trim()) return;
    let msg: RpcReq;
    try { msg = JSON.parse(line); } catch (e) {
      send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
      return;
    }
    const { id, method, params } = msg;
    if (id === undefined) return; // notification
    try {
      let result: any;
      if (method === "initialize") {
        result = { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "agent-desktop-rebuild", version: "1.2.0-rebuild" }, instructions: "Use desktop_snapshot to observe, act on refs, then snapshot again. Refs are snapshot-qualified." };
      } else if (method === "ping") {
        result = {};
      } else if (method === "tools/list") {
        result = { tools: TOOLS.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) };
      } else if (method === "tools/call") {
        const name = params?.name as string;
        const tool = TOOLS.find(t => t.name === name);
        if (!tool) throw Object.assign(new Error(`Unknown tool ${name}`), { code: -32602 });
        const args = params?.arguments || {};
        try {
          const data = await dispatch((tool as any)._cmd, args, globals);
          result = { content: [{ type: "text", text: JSON.stringify(ok((tool as any)._cmd, data)) }], isError: false };
        } catch (e) {
          const env = envelopeForError((tool as any)._cmd, e);
          result = { content: [{ type: "text", text: JSON.stringify(env) }], isError: true };
        }
      } else {
        send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
        return;
      }
      send({ jsonrpc: "2.0", id, result });
    } catch (e: any) {
      send({ jsonrpc: "2.0", id, error: { code: e.code || -32603, message: e.message || String(e) } });
    }
  });
}
