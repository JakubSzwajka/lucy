import { randomUUID } from "node:crypto";
import { Socket } from "node:net";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RpcCommand {
  type: string;
  id?: string;
  [key: string]: unknown;
}

export interface RpcResponse {
  type: "response";
  command: string;
  success: boolean;
  id?: string;
  data?: unknown;
  error?: string;
}

export type RpcEvent = Record<string, unknown> & { type: string };

type EventCallback = (event: RpcEvent) => void;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_SOCKET_PATH = "/tmp/lucy-pi.sock";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_CONNECT_RETRIES = 10;
const INITIAL_RETRY_DELAY_MS = 200;
const MAX_RETRY_DELAY_MS = 5_000;

// ---------------------------------------------------------------------------
// SocketClient
// ---------------------------------------------------------------------------

export class SocketClient {
  private socketPath: string;
  private socket: Socket | null = null;
  private buffer = "";
  private subscribers = new Set<EventCallback>();
  private pendingRequests = new Map<
    string,
    { resolve: (resp: RpcResponse) => void; reject: (err: Error) => void; timer: ReturnType<typeof setTimeout> }
  >();

  constructor(socketPath?: string) {
    this.socketPath = socketPath ?? process.env.PI_BRIDGE_SOCKET ?? DEFAULT_SOCKET_PATH;
  }

  get isConnected(): boolean {
    return this.socket !== null && !this.socket.destroyed;
  }

  get status(): "connected" | "disconnected" {
    return this.isConnected ? "connected" : "disconnected";
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    let delay = INITIAL_RETRY_DELAY_MS;

    for (let attempt = 1; attempt <= MAX_CONNECT_RETRIES; attempt++) {
      try {
        await this.connectOnce();
        return;
      } catch (err) {
        if (attempt === MAX_CONNECT_RETRIES) {
          throw new Error(
            `[runtime] failed to connect to pi-bridge at ${this.socketPath} after ${MAX_CONNECT_RETRIES} attempts: ${(err as Error).message}`,
          );
        }
        console.log(
          `[runtime] waiting for pi-bridge at ${this.socketPath} (attempt ${attempt}/${MAX_CONNECT_RETRIES})...`,
        );
        await new Promise<void>((r) => setTimeout(r, delay));
        delay = Math.min(delay * 2, MAX_RETRY_DELAY_MS);
      }
    }
  }

  private connectOnce(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const sock = new Socket();

      sock.on("connect", () => {
        this.socket = sock;
        console.log(`[runtime] connected to pi-bridge at ${this.socketPath}`);
        resolve();
      });

      sock.on("error", (err) => {
        if (!this.socket) {
          reject(new Error(`[runtime] failed to connect to ${this.socketPath}: ${err.message}`));
        } else {
          console.error(`[runtime] socket error: ${err.message}`);
        }
      });

      sock.on("data", (chunk: Buffer) => {
        this.handleData(chunk);
      });

      sock.on("close", () => {
        this.socket = null;
        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
          clearTimeout(pending.timer);
          pending.reject(new Error("[runtime] socket closed while waiting for response"));
          this.pendingRequests.delete(id);
        }
      });

      sock.connect(this.socketPath);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.subscribers.clear();
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error("[runtime] disconnected"));
    }
    this.pendingRequests.clear();
  }

  /**
   * Send a command and wait for a matching response (correlated by `id`).
   */
  async request(cmd: Omit<RpcCommand, "id"> & { id?: string; type: string }): Promise<RpcResponse> {
    if (!this.isConnected) {
      await this.connect();
    }

    const id = cmd.id ?? randomUUID();
    const command: RpcCommand = { ...cmd, id };

    return new Promise<RpcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`[runtime] request timed out: ${command.type} (id=${id})`));
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.send(command);
    });
  }

  /**
   * Send a command without waiting for a response.
   */
  async send(cmd: RpcCommand): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }
    if (!this.socket || this.socket.destroyed) {
      throw new Error("[runtime] not connected to pi-bridge");
    }
    const line = JSON.stringify(cmd) + "\n";
    this.socket.write(line);
  }

  /**
   * Subscribe to streaming events (everything that is NOT a response to a pending request).
   * Returns an unsubscribe function.
   */
  subscribe(callback: EventCallback): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private handleData(chunk: Buffer): void {
    this.buffer += chunk.toString("utf-8");

    // Split on newline only — NOT readline which splits on U+2028/U+2029
    let newlineIdx: number;
    while ((newlineIdx = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, newlineIdx);
      this.buffer = this.buffer.slice(newlineIdx + 1);

      if (!line.trim()) continue;

      let parsed: RpcEvent;
      try {
        parsed = JSON.parse(line) as RpcEvent;
      } catch {
        console.warn("[runtime] failed to parse JSONL line from pi-bridge:", line.slice(0, 200));
        continue;
      }

      this.dispatch(parsed);
    }
  }

  private dispatch(event: RpcEvent): void {
    // Check if this is a response to a pending request
    if (event.type === "response" && typeof event.id === "string") {
      const pending = this.pendingRequests.get(event.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(event.id);
        pending.resolve(event as unknown as RpcResponse);
        return;
      }
    }

    // Otherwise, broadcast to subscribers
    for (const cb of this.subscribers) {
      try {
        cb(event);
      } catch (err) {
        console.error("[runtime] subscriber error:", err);
      }
    }
  }
}
