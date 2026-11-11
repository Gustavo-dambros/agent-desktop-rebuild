import { Command } from "commander";
import { dispatch } from "../dispatch/dispatch.js";
import { ok, envelopeForError } from "../core/response/output.js";

function print(obj: any) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

export async function run(argv = process.argv) {
  const program = new Command();
  program
    .name("agent-desktop")
    .description("Reliable computer use for AI agents — see and operate desktop apps (rebuild)")
    .version("1.2.0-rebuild")
    .option("--session <id>", "Session id")
    .option("--agent-id <id>", "Agent id")
    .option("--headed", "Allow physical input", false)
    .option("--trace <path>", "Trace path")
    .option("--trace-strict", "Fail on trace errors", false)
    .option("--wait-for <selector>", "Post-action wait for selector")
    .option("--wait-for-gone <selector>", "Post-action wait for gone")
    .option("--wait-timeout-ms <ms>", "Wait timeout", (v)=>parseInt(v,10))
    .option("--cdp-port <port>", "Chrome DevTools port", (v)=>parseInt(v,10), 9222)
    .allowUnknownOption(true)
    .enablePositionalOptions(true);

  const globals = () => program.opts();

  const wrap = (name: string, handler: (args: any, g: any) => Promise<any>) => async (...all: any[]) => {
    const cmdObj = all[all.length - 1];
    const g = globals();
    const args = cmdObj && typeof cmdObj.opts === "function" ? { ...cmdObj.opts(), _: cmdObj.args } : { _: [] };
    // merge positional from earlier args
    if (all.length > 1 && typeof all[0] === 'string') {
      // commander passes positional args first; handled via args
    }
    try {
      const data = await handler(args, g);
      print(ok(name, data));
      process.exitCode = 0;
    } catch (e) {
      print(envelopeForError(name, e));
      process.exitCode = 1;
    }
  };

  // helper to attach common ref arg
  const refCmd = (name: string, desc: string) => program.command(name).description(desc).argument("[ref]").allowUnknownOption(true);

  program.command("snapshot").description("Capture accessibility tree as structured JSON with @ref IDs")
    .option("--app <name>", "App name")
    .option("--window-id <id>", "Window id")
    .option("--depth <n>", "Max depth", (v)=>parseInt(v,10), 50)
    .option("-i, --interactive", "Interactive elements only")
    .option("--compact", "Compact")
    .option("--include-bounds", "Include bounds")
    .option("--surface <surface>", "Surface", "window")
    .option("--skeleton", "Skeleton")
    .option("--root <ref>", "Root ref")
    .option("--timeout-ms <ms>", "Timeout ms", (v)=>parseInt(v,10))
    .option("--force-electron-a11y", "Force electron a11y")
    .action(async function(this: Command) { await wrap("snapshot", (a,g)=>dispatch("snapshot", a, g))(this); });

  program.command("find").description("Search elements").option("--app <name>").option("--name <name>").option("--role <role>").option("--text <text>")
    .action(async function(this: Command){ await wrap("find",(a,g)=>dispatch("find",a,g))(this); });

  program.command("click").description("Click element").argument("<ref>").action(async (ref: string, _o: any, cmd: Command)=>{ try{print(ok("click", await dispatch("click",{ref},globals())))}catch(e){print(envelopeForError("click",e));process.exitCode=1;} });
  program.command("double-click").description("Double click").argument("<ref>").action(async (ref:string)=>{ try{print(ok("double-click", await dispatch("double-click",{ref},globals())))}catch(e){print(envelopeForError("double-click",e));process.exitCode=1;} });
  program.command("triple-click").description("Triple click").argument("<ref>").action(async (ref:string)=>{ try{print(ok("triple-click", await dispatch("triple-click",{ref},globals())))}catch(e){print(envelopeForError("triple-click",e));process.exitCode=1;} });
  program.command("right-click").description("Right click").argument("<ref>").action(async (ref:string)=>{ try{print(ok("right-click", await dispatch("right-click",{ref},globals())))}catch(e){print(envelopeForError("right-click",e));process.exitCode=1;} });

  program.command("type").description("Type text into element").argument("<ref>").argument("[text]").option("--stdin", "Read from stdin")
    .action(async (ref:string, text:string|undefined, opts:any)=>{ try{ let t=text; if(opts.stdin){t = await new Promise<string>(res=>{let d="";process.stdin.setEncoding("utf8");process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>res(d)); if(process.stdin.isTTY) res("");}); }
      print(ok("type", await dispatch("type",{ref,text:t},globals())))}catch(e){print(envelopeForError("type",e));process.exitCode=1;} });

  program.command("set-value").description("Set value").argument("<ref>").argument("[value]").action(async (ref:string,value?:string)=>{ try{print(ok("set-value", await dispatch("set-value",{ref,value},globals())))}catch(e){print(envelopeForError("set-value",e));process.exitCode=1;} });
  program.command("clear").description("Clear").argument("<ref>").action(async (ref:string)=>{ try{print(ok("clear", await dispatch("clear",{ref},globals())))}catch(e){print(envelopeForError("clear",e));process.exitCode=1;} });
  program.command("focus").description("Focus").argument("<ref>").action(async (ref:string)=>{ try{print(ok("focus", await dispatch("focus",{ref},globals())))}catch(e){print(envelopeForError("focus",e));process.exitCode=1;} });
  program.command("select").description("Select option").argument("<ref>").argument("<value>").action(async (ref:string,value:string)=>{ try{print(ok("select", await dispatch("select",{ref,value},globals())))}catch(e){print(envelopeForError("select",e));process.exitCode=1;} });

  for (const name of ["toggle","check","uncheck","expand","collapse","scroll-to"]) {
    program.command(name).description(name).argument("<ref>").action(async (ref:string)=>{ try{print(ok(name, await dispatch(name,{ref},globals())))}catch(e){print(envelopeForError(name,e));process.exitCode=1;} });
  }

  program.command("scroll").description("Scroll").argument("<ref>").option("--direction <dir>", "direction", "down").option("--amount <n>", "amount", (v)=>parseInt(v,10), 3)
    .action(async (ref:string, opts:any)=>{ try{print(ok("scroll", await dispatch("scroll",{ref, ...opts},globals())))}catch(e){print(envelopeForError("scroll",e));process.exitCode=1;} });

  program.command("press").description("Press key combo").argument("<combo>").option("--app <name>").option("--window-id <id>").option("--force")
    .action(async (combo:string, opts:any)=>{ try{print(ok("press", await dispatch("press",{combo,...opts},globals())))}catch(e){print(envelopeForError("press",e));process.exitCode=1;} });

  for (const name of ["key-down","key-up"]) {
    program.command(name).description(name).argument("<combo>").action(async (combo:string)=>{ try{print(ok(name, await dispatch(name,{combo},globals())))}catch(e){print(envelopeForError(name,e));process.exitCode=1;} });
  }

  program.command("hover").description("Hover").argument("[ref]").action(async (ref?:string)=>{ try{print(ok("hover", await dispatch("hover",{ref},globals())))}catch(e){print(envelopeForError("hover",e));process.exitCode=1;} });
  program.command("drag").description("Drag").allowUnknownOption(true).action(async function(this:Command){ try{print(ok("drag", await dispatch("drag",this.opts(),globals())))}catch(e){print(envelopeForError("drag",e));process.exitCode=1;} });

  for (const name of ["mouse-move","mouse-click","mouse-down","mouse-up","mouse-wheel"]) {
    program.command(name).description(name).allowUnknownOption(true).action(async function(this:Command){ try{print(ok(name, await dispatch(name,this.opts(),globals())))}catch(e){print(envelopeForError(name,e));process.exitCode=1;} });
  }

  program.command("launch").description("Launch app").argument("[app]").allowUnknownOption(true).action(async function(this:Command){ try{print(ok("launch", await dispatch("launch",{app:this.args[0],...this.opts()},globals())))}catch(e){print(envelopeForError("launch",e));process.exitCode=1;} });
  program.command("close-app").description("Close app").argument("[app]").allowUnknownOption(true).action(async function(this:Command){ try{print(ok("close-app", await dispatch("close-app",{app:this.args[0],...this.opts()},globals())))}catch(e){print(envelopeForError("close-app",e));process.exitCode=1;} });
  program.command("list-windows").description("List windows").option("--app <name>").action(async function(this:Command){ try{print(ok("list-windows", await dispatch("list-windows",this.opts(),globals())))}catch(e){print(envelopeForError("list-windows",e));process.exitCode=1;} });
  program.command("list-displays").description("List displays").action(async ()=>{ try{print(ok("list-displays", await dispatch("list-displays",{},globals())))}catch(e){print(envelopeForError("list-displays",e));process.exitCode=1;} });
  program.command("list-apps").description("List apps").option("--app <name>").action(async function(this:Command){ try{print(ok("list-apps", await dispatch("list-apps",this.opts(),globals())))}catch(e){print(envelopeForError("list-apps",e));process.exitCode=1;} });

  for (const name of ["focus-window","resize-window","move-window","minimize","maximize","restore"]) {
    program.command(name).description(name).allowUnknownOption(true).action(async function(this:Command){ try{print(ok(name, await dispatch(name,{...this.opts(), _:this.args},globals())))}catch(e){print(envelopeForError(name,e));process.exitCode=1;} });
  }
  program.command("list-surfaces").description("List surfaces").allowUnknownOption(true).action(async function(this:Command){ try{print(ok("list-surfaces", await dispatch("list-surfaces",this.opts(),globals())))}catch(e){print(envelopeForError("list-surfaces",e));process.exitCode=1;} });
  program.command("open-system-surface").description("Open system surface").allowUnknownOption(true).action(async function(this:Command){ try{print(ok("open-system-surface", await dispatch("open-system-surface",this.opts(),globals())))}catch(e){print(envelopeForError("open-system-surface",e));process.exitCode=1;} });

  program.command("list-notifications").description("List notifications").allowUnknownOption(true).action(async function(this:Command){ try{print(ok("list-notifications", await dispatch("list-notifications",this.opts(),globals())))}catch(e){print(envelopeForError("list-notifications",e));process.exitCode=1;} });
  program.command("dismiss-notification").description("Dismiss notification").allowUnknownOption(true).action(async function(this:Command){ try{print(ok("dismiss-notification", await dispatch("dismiss-notification",this.opts(),globals())))}catch(e){print(envelopeForError("dismiss-notification",e));process.exitCode=1;} });
  program.command("dismiss-all-notifications").description("Dismiss all notifications").allowUnknownOption(true).action(async function(this:Command){ try{print(ok("dismiss-all-notifications", await dispatch("dismiss-all-notifications",this.opts(),globals())))}catch(e){print(envelopeForError("dismiss-all-notifications",e));process.exitCode=1;} });
  program.command("notification-action").description("Notification action").allowUnknownOption(true).action(async function(this:Command){ try{print(ok("notification-action", await dispatch("notification-action",this.opts(),globals())))}catch(e){print(envelopeForError("notification-action",e));process.exitCode=1;} });

  program.command("clipboard-get").description("Clipboard get").option("--out <path>").action(async function(this:Command){ try{print(ok("clipboard-get", await dispatch("clipboard-get",this.opts(),globals())))}catch(e){print(envelopeForError("clipboard-get",e));process.exitCode=1;} });
  program.command("clipboard-set").description("Clipboard set").argument("[text]").option("--stdin").action(async (text?:string, opts?:any)=>{ try{print(ok("clipboard-set", await dispatch("clipboard-set",{text,...opts},globals())))}catch(e){print(envelopeForError("clipboard-set",e));process.exitCode=1;} });
  program.command("clipboard-clear").description("Clipboard clear").action(async ()=>{ try{print(ok("clipboard-clear", await dispatch("clipboard-clear",{},globals())))}catch(e){print(envelopeForError("clipboard-clear",e));process.exitCode=1;} });

  program.command("wait").description("Wait").option("--ms <ms>", "ms", (v)=>parseInt(v,10)).allowUnknownOption(true).action(async function(this:Command){ try{print(ok("wait", await dispatch("wait",this.opts(),globals())))}catch(e){print(envelopeForError("wait",e));process.exitCode=1;} });
  program.command("status").description("Status").action(async ()=>{ try{print(ok("status", await dispatch("status",{},globals())))}catch(e){print(envelopeForError("status",e));process.exitCode=1;} });
  program.command("permissions").description("Permissions").option("--request").action(async function(this:Command){ try{print(ok("permissions", await dispatch("permissions",this.opts(),globals())))}catch(e){print(envelopeForError("permissions",e));process.exitCode=1;} });
  program.command("version").description("Version").action(async ()=>{ try{print(ok("version", await dispatch("version",{},globals())))}catch(e){print(envelopeForError("version",e));process.exitCode=1;} });

  program.command("batch").description("Batch").allowUnknownOption(true).action(async function(this:Command){ try{print(ok("batch", await dispatch("batch",this.opts(),globals())))}catch(e){print(envelopeForError("batch",e));process.exitCode=1;} });

  program.command("skills").description("Skills").argument("[action]").argument("[name]").action(async (action?:string,name?:string)=>{ try{print(ok("skills", await dispatch("skills",{action,name},globals())))}catch(e){print(envelopeForError("skills",e));process.exitCode=1;} });

  program.command("session").description("Session").argument("[action]").allowUnknownOption(true).action(async function(this:Command){ try{print(ok("session", await dispatch("session",{action:this.args[0],...this.opts()},globals())))}catch(e){print(envelopeForError("session",e));process.exitCode=1;} });
  program.command("cursor-overlay").description("Cursor overlay").allowUnknownOption(true).action(async function(this:Command){ try{print(ok("cursor-overlay", await dispatch("cursor-overlay",this.opts(),globals())))}catch(e){print(envelopeForError("cursor-overlay",e));process.exitCode=1;} });
  program.command("trace").description("Trace").argument("[action]").allowUnknownOption(true).action(async function(this:Command){ try{print(ok("trace", await dispatch("trace",{action:this.args[0],...this.opts()},globals())))}catch(e){print(envelopeForError("trace",e));process.exitCode=1;} });
  program.command("sandbox").description("Sandbox").argument("[action]").allowUnknownOption(true).action(async function(this:Command){ try{print(ok("sandbox", await dispatch("sandbox",{action:this.args[0],...this.opts()},globals())))}catch(e){print(envelopeForError("sandbox",e));process.exitCode=1;} });

  // MCP
  program.command("mcp").description("Serve MCP over stdio").action(async ()=>{ const { serveMcp } = await import("../mcp/server.js"); await serveMcp(globals()); });

  program.command("screenshot").description("Screenshot").allowUnknownOption(true).action(async function(this:Command){ try{print(ok("screenshot", await dispatch("screenshot",this.opts(),globals())))}catch(e){print(envelopeForError("screenshot",e));process.exitCode=1;} });
  program.command("get").description("Get property").argument("<ref>").argument("[property]").action(async (ref:string, property?:string)=>{ try{print(ok("get", await dispatch("get",{ref, property},globals())))}catch(e){print(envelopeForError("get",e));process.exitCode=1;} });
  program.command("is").description("Check state").argument("<ref>").argument("[property]").action(async (ref:string, property?:string)=>{ try{print(ok("is", await dispatch("is",{ref, property},globals())))}catch(e){print(envelopeForError("is",e));process.exitCode=1;} });

  await program.parseAsync(argv);
}
