import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { McpServer, McpTool, McpServerStatus } from "@/types";
import type { Tool } from "ai";
import { z } from "zod";

export interface McpClientWrapper {
  serverId: string;
  serverName: string;
  client: Client;
  transport: StdioClientTransport | SSEClientTransport;
  tools: McpTool[];
  connected: boolean;
}

/**
 * Create an MCP client for a server configuration
 */
export async function createMcpClient(server: McpServer): Promise<McpClientWrapper> {
  let transport: StdioClientTransport | SSEClientTransport;

  if (server.transportType === "stdio") {
    if (!server.command) {
      throw new Error("Command is required for stdio transport");
    }

    // Build env with server-specific overrides
    const env: Record<string, string> = {};
    // Copy process.env, filtering out undefined values
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }
    // Apply server-specific env vars
    if (server.env) {
      Object.assign(env, server.env);
    }

    transport = new StdioClientTransport({
      command: server.command,
      args: server.args || [],
      env,
    });
  } else {
    // HTTP or SSE transport
    if (!server.url) {
      throw new Error("URL is required for HTTP/SSE transport");
    }

    transport = new SSEClientTransport(new URL(server.url), {
      requestInit: server.headers
        ? { headers: server.headers }
        : undefined,
    });
  }

  const client = new Client(
    {
      name: "lucy-mcp-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  await client.connect(transport);

  // Discover tools
  const toolsResult = await client.listTools();
  const tools: McpTool[] = (toolsResult.tools || []).map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema as Record<string, unknown>,
    serverId: server.id,
    serverName: server.name,
  }));

  return {
    serverId: server.id,
    serverName: server.name,
    client,
    transport,
    tools,
    connected: true,
  };
}

/**
 * Close an MCP client connection
 */
export async function closeMcpClient(wrapper: McpClientWrapper): Promise<void> {
  try {
    await wrapper.client.close();
  } catch (error) {
    console.error(`Error closing MCP client ${wrapper.serverName}:`, error);
  }
}

/**
 * Execute a tool on an MCP server
 */
export async function executeToolCall(
  wrapper: McpClientWrapper,
  toolName: string,
  args: Record<string, unknown>
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  try {
    const result = await wrapper.client.callTool({
      name: toolName,
      arguments: args,
    });

    // Check if result contains error
    if (result.isError) {
      const errorContent = Array.isArray(result.content) ? result.content[0] : undefined;
      const errorMessage = errorContent && typeof errorContent === "object" && "text" in errorContent
        ? String(errorContent.text)
        : "Tool execution failed";
      return { success: false, error: errorMessage };
    }

    // Extract result content
    const content = result.content;
    if (Array.isArray(content) && content.length > 0) {
      const firstContent = content[0];
      if (firstContent && typeof firstContent === "object" && "text" in firstContent) {
        const textValue = String(firstContent.text);
        // Try to parse as JSON, otherwise return as string
        try {
          return { success: true, result: JSON.parse(textValue) };
        } catch {
          return { success: true, result: textValue };
        }
      }
    }

    return { success: true, result: content };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Simple tool type for our use case
export interface SimpleTool {
  description: string;
  parameters: z.ZodTypeAny;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Convert MCP tools to AI SDK tool format
 */
export function convertToAiSdkTools(
  wrappers: McpClientWrapper[],
  onToolCall?: (serverId: string, toolName: string, args: Record<string, unknown>) => Promise<boolean>
): Record<string, SimpleTool> {
  const tools: Record<string, SimpleTool> = {};

  for (const wrapper of wrappers) {
    for (const tool of wrapper.tools) {
      // Create a unique key for the tool (namespace by server to avoid collisions)
      const toolKey = `${wrapper.serverId}__${tool.name}`;

      // Convert JSON Schema to zod schema (simplified - accepts any object)
      const zodSchema = z.record(z.string(), z.unknown());

      tools[toolKey] = {
        description: tool.description || `Tool: ${tool.name}`,
        parameters: zodSchema,
        execute: async (args: Record<string, unknown>) => {
          // Optional pre-execution callback (for approval flow)
          if (onToolCall) {
            const approved = await onToolCall(wrapper.serverId, tool.name, args);
            if (!approved) {
              return { error: "Tool execution was rejected by user" };
            }
          }

          const result = await executeToolCall(wrapper, tool.name, args);
          if (!result.success) {
            return { error: result.error };
          }
          return result.result;
        },
      };
    }
  }

  return tools;
}

/**
 * Get status for all connected clients
 */
export function getClientStatuses(wrappers: McpClientWrapper[]): McpServerStatus[] {
  return wrappers.map((wrapper) => ({
    serverId: wrapper.serverId,
    serverName: wrapper.serverName,
    connected: wrapper.connected,
    tools: wrapper.tools,
    requireApproval: false, // Will be set by the pool
  }));
}
