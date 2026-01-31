/**
 * Obsidian Local REST API Client
 *
 * Provides CRUD operations for Obsidian vault via Local REST API.
 * Requires the Obsidian Local REST API plugin to be installed and configured.
 *
 * @see https://github.com/coddingtonbear/obsidian-local-rest-api
 */

// ============================================================================
// Types
// ============================================================================

export interface NoteInfo {
  path: string;
  name: string;
}

export interface NoteContent {
  path: string;
  name: string;
  content: string;
}

// ============================================================================
// Client
// ============================================================================

export class ObsidianClient {
  constructor(
    private baseUrl: string,
    private apiKey: string
  ) {}

  private async request<T>(
    method: string,
    path: string,
    options: { body?: string; accept?: string; contentType?: string } = {}
  ): Promise<{ data: T | null; error?: string; status: number }> {
    try {
      // Disable TLS verification for self-signed cert
      if (typeof process !== "undefined") {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
      }

      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...(options.accept && { Accept: options.accept }),
          ...(options.contentType && { "Content-Type": options.contentType }),
        },
        body: options.body,
      });

      if (res.status === 404) {
        return { data: null, status: 404 };
      }

      if (!res.ok) {
        return { data: null, error: await res.text(), status: res.status };
      }

      if (res.status === 204) {
        return { data: null, status: 204 };
      }

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return { data: (await res.json()) as T, status: res.status };
      }

      return { data: (await res.text()) as unknown as T, status: res.status };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : "Connection failed",
        status: 500,
      };
    }
  }

  async listNotes(folder: string = ""): Promise<NoteInfo[]> {
    const path = folder ? `/vault/${encodeURIComponent(folder + "/")}` : "/vault/";
    const { data, error } = await this.request<{ files: string[] }>("GET", path);

    if (error) {
      throw new Error(error);
    }

    return (data?.files || [])
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({
        path: folder ? `${folder}/${f}` : f,
        name: f.replace(/\.md$/, ""),
      }));
  }

  async readNote(notePath: string): Promise<NoteContent | null> {
    const fullPath = notePath.endsWith(".md") ? notePath : `${notePath}.md`;

    const { data: content, status, error } = await this.request<string>(
      "GET",
      `/vault/${encodeURIComponent(fullPath)}`,
      { accept: "text/markdown" }
    );

    if (status === 404) {
      return null;
    }

    if (error) {
      throw new Error(error);
    }

    return {
      path: fullPath,
      name: fullPath.replace(/\.md$/, "").split("/").pop() || fullPath,
      content: content || "",
    };
  }

  async writeNote(notePath: string, content: string): Promise<void> {
    const fullPath = notePath.endsWith(".md") ? notePath : `${notePath}.md`;

    const { error } = await this.request(
      "PUT",
      `/vault/${encodeURIComponent(fullPath)}`,
      { body: content, contentType: "text/markdown" }
    );

    if (error) {
      throw new Error(error);
    }
  }

  async deleteNote(notePath: string): Promise<boolean> {
    const fullPath = notePath.endsWith(".md") ? notePath : `${notePath}.md`;

    const { status, error } = await this.request(
      "DELETE",
      `/vault/${encodeURIComponent(fullPath)}`
    );

    if (status === 404) {
      return false;
    }

    if (error) {
      throw new Error(error);
    }

    return true;
  }

  async checkConnection(): Promise<{ connected: boolean; error?: string }> {
    const { data, error } = await this.request<{ ok: boolean; authenticated: boolean }>("GET", "/");

    if (error) {
      return { connected: false, error };
    }

    if (!data?.ok) {
      return { connected: false, error: "Obsidian API not responding" };
    }

    if (!data?.authenticated) {
      return { connected: false, error: "Invalid API key" };
    }

    return { connected: true };
  }
}
