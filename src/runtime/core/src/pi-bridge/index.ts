import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Socket, type Server } from "node:net";
import { unlinkSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const SOCKET_PATH = process.env.PI_BRIDGE_SOCKET ?? "/tmp/lucy-pi.sock";

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    process.stderr.write(`[pi-bridge] ERROR: ${name} is required but not set\n`);
    process.exit(1);
  }
  return val;
}

function buildPiArgs(): string[] {
  const model = requireEnv("PI_BRIDGE_MODEL");
  const args = ["--mode", "rpc", "--model", model, "-c"];

  const optionalFlags: Record<string, string> = {
    PI_BRIDGE_PROVIDER: "--provider",
  };

  for (const [env, flag] of Object.entries(optionalFlags)) {
    const val = process.env[env];
    if (val) args.push(flag, val);
  }

  if (process.env.PI_BRIDGE_NO_SESSION) {
    args.push("--no-session");
  }

  // Append prompt.md as system prompt if it exists
  const promptPath = resolve(process.env.PI_BRIDGE_PROMPT ?? "prompt.md");
  if (existsSync(promptPath)) {
    args.push("--append-system-prompt", promptPath);
    log(`using prompt file: ${promptPath}`);
  }

  return args;
}

function log(msg: string): void {
  process.stderr.write(`[pi-bridge] ${msg}\n`);
}

// --- child process ---

const piArgs = buildPiArgs();
const piBin = resolve("node_modules/.bin/pi");
const pi: ChildProcess = spawn(piBin, piArgs, {
  stdio: ["pipe", "pipe", "pipe"],
});

pi.stderr!.pipe(process.stderr);

pi.on("exit", (code, signal) => {
  log(`pi exited (code=${code}, signal=${signal})`);
  cleanup();
  process.exit(1);
});

pi.on("error", (err) => {
  log(`pi spawn error: ${err.message}`);
  cleanup();
  process.exit(1);
});

// --- unix socket server ---

let activeClient: Socket | null = null;
let piStdoutBuffer = "";

function handlePiStdout(chunk: Buffer): void {
  if (!activeClient || activeClient.destroyed) return;

  piStdoutBuffer += chunk.toString();
  const lines = piStdoutBuffer.split("\n");
  // Keep the last (possibly incomplete) segment in the buffer
  piStdoutBuffer = lines.pop()!;

  for (const line of lines) {
    if (line.length === 0) continue;
    activeClient.write(line + "\n");
  }
}

pi.stdout!.on("data", handlePiStdout);

function handleClient(socket: Socket): void {
  if (activeClient && !activeClient.destroyed) {
    log("new client connected, closing previous");
    activeClient.destroy();
  }

  activeClient = socket;
  piStdoutBuffer = "";
  log("client connected");

  let clientBuffer = "";

  socket.on("data", (chunk: Buffer) => {
    clientBuffer += chunk.toString();
    const lines = clientBuffer.split("\n");
    clientBuffer = lines.pop()!;

    for (const line of lines) {
      if (line.length === 0) continue;
      pi.stdin!.write(line + "\n");
    }
  });

  socket.on("close", () => {
    log("client disconnected");
    if (activeClient === socket) {
      activeClient = null;
    }
    clientBuffer = "";
  });

  socket.on("error", (err) => {
    log(`client socket error: ${err.message}`);
    if (activeClient === socket) {
      activeClient = null;
    }
  });
}

// Remove stale socket file
if (existsSync(SOCKET_PATH)) {
  unlinkSync(SOCKET_PATH);
}

const server: Server = createServer(handleClient);

server.listen(SOCKET_PATH, () => {
  log(`listening on ${SOCKET_PATH}`);
});

server.on("error", (err) => {
  log(`server error: ${err.message}`);
  cleanup();
  process.exit(1);
});

// --- cleanup ---

function cleanup(): void {
  try {
    server.close();
  } catch {}
  try {
    if (existsSync(SOCKET_PATH)) unlinkSync(SOCKET_PATH);
  } catch {}
  try {
    pi.kill();
  } catch {}
}

process.on("SIGTERM", () => {
  log("received SIGTERM, shutting down");
  cleanup();
  process.exit(0);
});

process.on("SIGINT", () => {
  log("received SIGINT, shutting down");
  cleanup();
  process.exit(0);
});
