import type { ToolProvider, ToolDefinition } from "../types";

// ============================================================================
// Builtin Tool Provider
// ============================================================================

export class BuiltinToolProvider implements ToolProvider {
  readonly name = "builtin";

  private tools: ToolDefinition[] = [];

  constructor(tools: ToolDefinition[] = []) {
    this.tools = tools;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getTools(): Promise<ToolDefinition[]> {
    return this.tools;
  }

  // -------------------------------------------------------------------------
  // Tool Management
  // -------------------------------------------------------------------------

  addTool(tool: ToolDefinition): void {
    // Ensure source is builtin type
    if (tool.source.type !== "builtin") {
      throw new Error("BuiltinToolProvider only accepts tools with source.type = 'builtin'");
    }
    this.tools.push(tool);
  }

  addTools(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.addTool(tool);
    }
  }

  removeTool(name: string, category: string): void {
    this.tools = this.tools.filter(
      (t) =>
        !(
          t.name === name &&
          t.source.type === "builtin" &&
          t.source.category === category
        )
    );
  }

  clearTools(): void {
    this.tools = [];
  }

  // Get tools by category
  getToolsByCategory(category: string): ToolDefinition[] {
    return this.tools.filter(
      (t) => t.source.type === "builtin" && t.source.category === category
    );
  }
}
