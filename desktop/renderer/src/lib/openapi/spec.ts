// OpenAPI 3.1 specification for Lucy Desktop App API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const openApiSpec: Record<string, any> = {
  openapi: "3.1.0",
  info: {
    title: "Lucy Desktop App API",
    description: "REST API for Lucy - AI-powered desktop application with multi-agent support",
    version: "0.1.0",
    contact: {
      name: "Lucy Development Team",
    },
  },
  servers: [
    {
      url: "http://localhost:8888",
      description: "Development server",
    },
  ],
  tags: [
    { name: "Sessions", description: "User-facing conversation containers" },
    { name: "Chat", description: "Session-based AI chat streaming" },
    { name: "System Prompts", description: "Reusable system prompts" },
    { name: "Settings", description: "Application settings" },
    { name: "Providers", description: "Available AI providers" },
    { name: "MCP Servers", description: "Model Context Protocol server management" },
    { name: "Knowledge", description: "Knowledge graph management" },
  ],
  paths: {
    // ========== SESSIONS ==========
    "/api/sessions": {
      get: {
        tags: ["Sessions"],
        summary: "List all sessions",
        operationId: "listSessions",
        responses: {
          "200": {
            description: "List of sessions",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Session" },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Sessions"],
        summary: "Create a new session",
        operationId: "createSession",
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SessionCreate" },
            },
          },
        },
        responses: {
          "201": {
            description: "Created session",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Session" },
              },
            },
          },
          "400": {
            description: "Bad request",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
        },
      },
    },
    "/api/sessions/{id}": {
      get: {
        tags: ["Sessions"],
        summary: "Get session with agents and items",
        operationId: "getSession",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Session with full agent tree",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SessionWithAgents" },
              },
            },
          },
          "404": {
            description: "Session not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
        },
      },
      patch: {
        tags: ["Sessions"],
        summary: "Update session",
        operationId: "updateSession",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SessionUpdate" },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated session",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Session" },
              },
            },
          },
          "404": {
            description: "Session not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Sessions"],
        summary: "Delete session",
        operationId: "deleteSession",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "204": {
            description: "Session deleted",
          },
          "404": {
            description: "Session not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
        },
      },
    },

    // ========== SESSION CHAT ==========
    "/api/sessions/{id}/chat": {
      post: {
        tags: ["Sessions"],
        summary: "Stream AI chat response for a session",
        operationId: "sessionChat",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Session ID",
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SessionChatRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Streaming response",
            content: {
              "text/event-stream": {
                schema: {
                  type: "string",
                  description: "Server-sent events stream",
                },
              },
            },
          },
          "404": {
            description: "Session not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
        },
      },
    },

    // ========== SYSTEM PROMPTS ==========
    "/api/system-prompts": {
      get: {
        tags: ["System Prompts"],
        summary: "List all system prompts",
        operationId: "listSystemPrompts",
        responses: {
          "200": {
            description: "List of system prompts",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/SystemPrompt" },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["System Prompts"],
        summary: "Create a system prompt",
        operationId: "createSystemPrompt",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SystemPromptCreate" },
            },
          },
        },
        responses: {
          "201": {
            description: "Created system prompt",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SystemPrompt" },
              },
            },
          },
          "400": {
            description: "Bad request",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
        },
      },
    },
    "/api/system-prompts/{id}": {
      get: {
        tags: ["System Prompts"],
        summary: "Get a system prompt",
        operationId: "getSystemPrompt",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "System prompt",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SystemPrompt" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
        },
      },
      patch: {
        tags: ["System Prompts"],
        summary: "Update a system prompt",
        operationId: "updateSystemPrompt",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SystemPromptUpdate" },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated system prompt",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SystemPrompt" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["System Prompts"],
        summary: "Delete a system prompt",
        operationId: "deleteSystemPrompt",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "204": {
            description: "Deleted",
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
        },
      },
    },

    // ========== SETTINGS ==========
    "/api/settings": {
      get: {
        tags: ["Settings"],
        summary: "Get current settings",
        operationId: "getSettings",
        responses: {
          "200": {
            description: "Current settings",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserSettings" },
              },
            },
          },
        },
      },
      patch: {
        tags: ["Settings"],
        summary: "Update settings",
        operationId: "updateSettings",
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SettingsUpdate" },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated settings",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserSettings" },
              },
            },
          },
        },
      },
    },

    // ========== PROVIDERS ==========
    "/api/providers": {
      get: {
        tags: ["Providers"],
        summary: "Get available AI providers",
        operationId: "getProviders",
        responses: {
          "200": {
            description: "Available providers",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AvailableProviders" },
              },
            },
          },
        },
      },
    },

    // ========== MCP SERVERS ==========
    "/api/mcp-servers": {
      get: {
        tags: ["MCP Servers"],
        summary: "List all MCP servers",
        operationId: "listMcpServers",
        responses: {
          "200": {
            description: "List of MCP servers",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/McpServer" },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["MCP Servers"],
        summary: "Create an MCP server",
        operationId: "createMcpServer",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/McpServerCreate" },
            },
          },
        },
        responses: {
          "201": {
            description: "Created MCP server",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/McpServer" },
              },
            },
          },
          "400": {
            description: "Bad request",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
        },
      },
    },
    "/api/mcp-servers/{id}": {
      get: {
        tags: ["MCP Servers"],
        summary: "Get an MCP server",
        operationId: "getMcpServer",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "MCP server",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/McpServer" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
        },
      },
      patch: {
        tags: ["MCP Servers"],
        summary: "Update an MCP server",
        operationId: "updateMcpServer",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/McpServerUpdate" },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated MCP server",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/McpServer" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["MCP Servers"],
        summary: "Delete an MCP server",
        operationId: "deleteMcpServer",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "204": {
            description: "Deleted",
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
        },
      },
    },
    "/api/mcp-servers/{id}/test": {
      post: {
        tags: ["MCP Servers"],
        summary: "Test MCP server connection",
        operationId: "testMcpServer",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Test result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    error: { type: "string" },
                    tools: {
                      type: "array",
                      items: { $ref: "#/components/schemas/McpTool" },
                    },
                  },
                },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
        },
      },
    },
    "/api/mcp-servers/status": {
      get: {
        tags: ["MCP Servers"],
        summary: "Get connection status of all enabled MCP servers",
        operationId: "getMcpServersStatus",
        responses: {
          "200": {
            description: "Status of all enabled MCP servers",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/McpServerStatus" },
                },
              },
            },
          },
        },
      },
    },

    // ========== KNOWLEDGE ==========
    "/api/knowledge/config": {
      get: {
        tags: ["Knowledge"],
        summary: "Get knowledge config",
        operationId: "getKnowledgeConfig",
        responses: {
          "200": {
            description: "Knowledge configuration",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/KnowledgeConfig" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
        },
      },
      put: {
        tags: ["Knowledge"],
        summary: "Update knowledge config",
        operationId: "updateKnowledgeConfig",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/KnowledgeConfig" },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated config",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/KnowledgeConfig" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
        },
      },
    },
    "/api/knowledge/tags": {
      get: {
        tags: ["Knowledge"],
        summary: "List all tag categories",
        operationId: "listTagCategories",
        responses: {
          "200": {
            description: "List of tag categories",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/TagCategory" },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Knowledge"],
        summary: "Create a tag category",
        operationId: "createTagCategory",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TagCategoryCreate" },
            },
          },
        },
        responses: {
          "201": {
            description: "Created tag category",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/TagCategory" },
                },
              },
            },
          },
          "400": {
            description: "Bad request",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
        },
      },
    },
    "/api/knowledge/tags/{categoryId}": {
      get: {
        tags: ["Knowledge"],
        summary: "Get a tag category",
        operationId: "getTagCategory",
        parameters: [
          {
            name: "categoryId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Tag category",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TagCategory" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
        },
      },
      put: {
        tags: ["Knowledge"],
        summary: "Update a tag category",
        operationId: "updateTagCategory",
        parameters: [
          {
            name: "categoryId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TagCategoryUpdate" },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated tag category",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TagCategory" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Knowledge"],
        summary: "Delete a tag category",
        operationId: "deleteTagCategory",
        parameters: [
          {
            name: "categoryId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "204": {
            description: "Deleted",
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
        },
      },
    },
    "/api/knowledge/tags/{categoryId}/values": {
      post: {
        tags: ["Knowledge"],
        summary: "Add value to tag category",
        operationId: "addTagValue",
        parameters: [
          {
            name: "categoryId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TagValue" },
            },
          },
        },
        responses: {
          "201": {
            description: "Updated tag category",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TagCategory" },
              },
            },
          },
          "400": {
            description: "Bad request",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Knowledge"],
        summary: "Remove value from tag category",
        operationId: "removeTagValue",
        parameters: [
          {
            name: "categoryId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  valueId: { type: "string" },
                },
                required: ["valueId"],
              },
            },
          },
        },
        responses: {
          "204": {
            description: "Value removed",
          },
          "400": {
            description: "Bad request",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
        },
      },
    },
    "/api/knowledge/entities": {
      get: {
        tags: ["Knowledge"],
        summary: "List entities",
        operationId: "listEntities",
        parameters: [
          {
            name: "type",
            in: "query",
            required: false,
            description: "Filter by entity type",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "List of entities",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Entity" },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Knowledge"],
        summary: "Create an entity",
        operationId: "createEntity",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/EntityCreate" },
            },
          },
        },
        responses: {
          "201": {
            description: "Created entity",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Entity" },
              },
            },
          },
          "400": {
            description: "Bad request",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
          "409": {
            description: "Entity already exists",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
        },
      },
    },
    "/api/knowledge/entities/{id}": {
      get: {
        tags: ["Knowledge"],
        summary: "Get an entity",
        operationId: "getEntity",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Entity",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Entity" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
        },
      },
      put: {
        tags: ["Knowledge"],
        summary: "Update an entity",
        operationId: "updateEntity",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/EntityUpdate" },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated entity",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Entity" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Knowledge"],
        summary: "Delete an entity",
        operationId: "deleteEntity",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "204": {
            description: "Deleted",
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" },
              },
            },
          },
        },
      },
    },
    "/api/knowledge/stats": {
      get: {
        tags: ["Knowledge"],
        summary: "Get knowledge graph statistics",
        operationId: "getKnowledgeStats",
        responses: {
          "200": {
            description: "Graph statistics",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/KnowledgeStats" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      // ========== COMMON ==========
      ApiError: {
        type: "object",
        properties: {
          error: { type: "string" },
          details: { type: "string" },
        },
        required: ["error"],
      },

      // ========== SESSION ==========
      Session: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          userId: { type: "string", nullable: true },
          rootAgentId: { type: "string", nullable: true },
          title: { type: "string" },
          status: { $ref: "#/components/schemas/SessionStatus" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
        required: ["id", "title", "status", "createdAt", "updatedAt"],
      },
      SessionStatus: {
        type: "string",
        enum: ["active", "archived"],
      },
      SessionCreate: {
        type: "object",
        properties: {
          title: { type: "string" },
          agentName: { type: "string" },
          systemPrompt: { type: "string" },
          model: { type: "string" },
        },
      },
      SessionUpdate: {
        type: "object",
        properties: {
          title: { type: "string" },
          status: { $ref: "#/components/schemas/SessionStatus" },
        },
      },
      SessionWithAgents: {
        allOf: [
          { $ref: "#/components/schemas/Session" },
          {
            type: "object",
            properties: {
              agents: {
                type: "array",
                items: { $ref: "#/components/schemas/AgentWithItems" },
              },
            },
            required: ["agents"],
          },
        ],
      },

      // ========== AGENT ==========
      Agent: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          sessionId: { type: "string", format: "uuid" },
          parentId: { type: "string", nullable: true },
          sourceCallId: { type: "string", nullable: true },
          name: { type: "string" },
          task: { type: "string", nullable: true },
          systemPrompt: { type: "string", nullable: true },
          model: { type: "string", nullable: true },
          config: { type: "object", nullable: true },
          status: { $ref: "#/components/schemas/AgentStatus" },
          waitingForCallId: { type: "string", nullable: true },
          result: { type: "string", nullable: true },
          error: { type: "string", nullable: true },
          turnCount: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
          startedAt: { type: "string", format: "date-time", nullable: true },
          completedAt: { type: "string", format: "date-time", nullable: true },
        },
        required: ["id", "sessionId", "name", "status", "turnCount", "createdAt"],
      },
      AgentStatus: {
        type: "string",
        enum: ["pending", "running", "waiting", "completed", "failed", "cancelled"],
      },
      AgentCreate: {
        type: "object",
        properties: {
          sessionId: { type: "string", format: "uuid" },
          parentId: { type: "string" },
          sourceCallId: { type: "string" },
          name: { type: "string" },
          task: { type: "string" },
          systemPrompt: { type: "string" },
          model: { type: "string" },
          config: { type: "object" },
        },
        required: ["sessionId", "name"],
      },
      AgentUpdate: {
        type: "object",
        properties: {
          status: { $ref: "#/components/schemas/AgentStatus" },
          waitingForCallId: { type: "string", nullable: true },
          result: { type: "string" },
          error: { type: "string" },
          turnCount: { type: "integer" },
          startedAt: { type: "string", format: "date-time" },
          completedAt: { type: "string", format: "date-time" },
        },
      },
      AgentWithItems: {
        allOf: [
          { $ref: "#/components/schemas/Agent" },
          {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: { $ref: "#/components/schemas/Item" },
              },
              children: {
                type: "array",
                items: { $ref: "#/components/schemas/AgentWithItems" },
              },
            },
            required: ["items"],
          },
        ],
      },

      // ========== ITEMS ==========
      ItemBase: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          agentId: { type: "string", format: "uuid" },
          sequence: { type: "integer" },
          type: { $ref: "#/components/schemas/ItemType" },
          createdAt: { type: "string", format: "date-time" },
        },
        required: ["id", "agentId", "sequence", "type", "createdAt"],
      },
      ItemType: {
        type: "string",
        enum: ["message", "tool_call", "tool_result", "reasoning"],
      },
      MessageRole: {
        type: "string",
        enum: ["user", "assistant", "system"],
      },
      ToolCallStatus: {
        type: "string",
        enum: ["pending", "pending_approval", "running", "completed", "failed"],
      },
      MessageItem: {
        allOf: [
          { $ref: "#/components/schemas/ItemBase" },
          {
            type: "object",
            properties: {
              type: { const: "message" },
              role: { $ref: "#/components/schemas/MessageRole" },
              content: { type: "string" },
            },
            required: ["role", "content"],
          },
        ],
      },
      ToolCallItem: {
        allOf: [
          { $ref: "#/components/schemas/ItemBase" },
          {
            type: "object",
            properties: {
              type: { const: "tool_call" },
              callId: { type: "string" },
              toolName: { type: "string" },
              toolArgs: { type: "object", nullable: true },
              toolStatus: { $ref: "#/components/schemas/ToolCallStatus" },
            },
            required: ["callId", "toolName", "toolStatus"],
          },
        ],
      },
      ToolResultItem: {
        allOf: [
          { $ref: "#/components/schemas/ItemBase" },
          {
            type: "object",
            properties: {
              type: { const: "tool_result" },
              callId: { type: "string" },
              toolOutput: { type: "string", nullable: true },
              toolError: { type: "string", nullable: true },
            },
            required: ["callId"],
          },
        ],
      },
      ReasoningItem: {
        allOf: [
          { $ref: "#/components/schemas/ItemBase" },
          {
            type: "object",
            properties: {
              type: { const: "reasoning" },
              reasoningContent: { type: "string" },
              reasoningSummary: { type: "string", nullable: true },
            },
            required: ["reasoningContent"],
          },
        ],
      },
      Item: {
        oneOf: [
          { $ref: "#/components/schemas/MessageItem" },
          { $ref: "#/components/schemas/ToolCallItem" },
          { $ref: "#/components/schemas/ToolResultItem" },
          { $ref: "#/components/schemas/ReasoningItem" },
        ],
        discriminator: {
          propertyName: "type",
          mapping: {
            message: "#/components/schemas/MessageItem",
            tool_call: "#/components/schemas/ToolCallItem",
            tool_result: "#/components/schemas/ToolResultItem",
            reasoning: "#/components/schemas/ReasoningItem",
          },
        },
      },
      ItemCreate: {
        oneOf: [
          {
            type: "object",
            properties: {
              type: { const: "message" },
              role: { $ref: "#/components/schemas/MessageRole" },
              content: { type: "string" },
            },
            required: ["type", "role", "content"],
          },
          {
            type: "object",
            properties: {
              type: { const: "tool_call" },
              callId: { type: "string" },
              toolName: { type: "string" },
              toolArgs: { type: "object" },
              toolStatus: { $ref: "#/components/schemas/ToolCallStatus" },
            },
            required: ["type", "callId", "toolName"],
          },
          {
            type: "object",
            properties: {
              type: { const: "tool_result" },
              callId: { type: "string" },
              toolOutput: { type: "string" },
              toolError: { type: "string" },
            },
            required: ["type", "callId"],
          },
          {
            type: "object",
            properties: {
              type: { const: "reasoning" },
              reasoningContent: { type: "string" },
              reasoningSummary: { type: "string" },
            },
            required: ["type", "reasoningContent"],
          },
        ],
      },

      // ========== CHAT ==========
      SessionChatRequest: {
        type: "object",
        properties: {
          messages: {
            type: "array",
            items: {
              type: "object",
              properties: {
                role: { type: "string" },
                content: { type: "string" },
              },
              required: ["role", "content"],
            },
          },
          model: { type: "string", description: "Model ID override" },
          thinkingEnabled: { type: "boolean", default: true },
        },
        required: ["messages"],
      },

      // ========== SYSTEM PROMPTS ==========
      SystemPrompt: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          content: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
        required: ["id", "name", "content", "createdAt", "updatedAt"],
      },
      SystemPromptCreate: {
        type: "object",
        properties: {
          name: { type: "string" },
          content: { type: "string" },
        },
        required: ["name", "content"],
      },
      SystemPromptUpdate: {
        type: "object",
        properties: {
          name: { type: "string" },
          content: { type: "string" },
        },
      },

      // ========== SETTINGS ==========
      UserSettings: {
        type: "object",
        properties: {
          id: { type: "string" },
          defaultModelId: { type: "string", nullable: true },
          defaultSystemPromptId: { type: "string", nullable: true },
          enabledModels: {
            type: "array",
            items: { type: "string" },
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
        required: ["id", "enabledModels", "createdAt", "updatedAt"],
      },
      SettingsUpdate: {
        type: "object",
        properties: {
          defaultModelId: { type: "string", nullable: true },
          defaultSystemPromptId: { type: "string", nullable: true },
          enabledModels: {
            type: "array",
            items: { type: "string" },
          },
        },
      },

      // ========== PROVIDERS ==========
      AvailableProviders: {
        type: "object",
        properties: {
          openai: { type: "boolean" },
          anthropic: { type: "boolean" },
          google: { type: "boolean" },
        },
        required: ["openai", "anthropic", "google"],
      },

      // ========== MCP SERVERS ==========
      McpTransportType: {
        type: "string",
        enum: ["stdio", "sse", "http"],
      },
      McpServer: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          description: { type: "string", nullable: true },
          transportType: { $ref: "#/components/schemas/McpTransportType" },
          command: { type: "string", nullable: true },
          args: { type: "array", items: { type: "string" }, nullable: true },
          env: { type: "object", additionalProperties: { type: "string" }, nullable: true },
          url: { type: "string", nullable: true },
          headers: { type: "object", additionalProperties: { type: "string" }, nullable: true },
          requireApproval: { type: "boolean" },
          enabled: { type: "boolean" },
          iconUrl: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
        required: ["id", "name", "transportType", "requireApproval", "enabled", "createdAt", "updatedAt"],
      },
      McpServerCreate: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          transportType: { $ref: "#/components/schemas/McpTransportType" },
          command: { type: "string" },
          args: { type: "array", items: { type: "string" } },
          env: { type: "object", additionalProperties: { type: "string" } },
          url: { type: "string" },
          headers: { type: "object", additionalProperties: { type: "string" } },
          requireApproval: { type: "boolean" },
          enabled: { type: "boolean" },
          iconUrl: { type: "string" },
        },
        required: ["name", "transportType"],
      },
      McpServerUpdate: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string", nullable: true },
          transportType: { $ref: "#/components/schemas/McpTransportType" },
          command: { type: "string", nullable: true },
          args: { type: "array", items: { type: "string" }, nullable: true },
          env: { type: "object", additionalProperties: { type: "string" }, nullable: true },
          url: { type: "string", nullable: true },
          headers: { type: "object", additionalProperties: { type: "string" }, nullable: true },
          requireApproval: { type: "boolean" },
          enabled: { type: "boolean" },
          iconUrl: { type: "string", nullable: true },
        },
      },
      McpTool: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          inputSchema: { type: "object" },
          serverId: { type: "string" },
          serverName: { type: "string" },
        },
        required: ["name", "serverId", "serverName"],
      },
      McpServerStatus: {
        type: "object",
        properties: {
          serverId: { type: "string" },
          serverName: { type: "string" },
          connected: { type: "boolean" },
          tools: {
            type: "array",
            items: { $ref: "#/components/schemas/McpTool" },
          },
          error: { type: "string" },
          requireApproval: { type: "boolean" },
        },
        required: ["serverId", "serverName", "connected", "tools", "requireApproval"],
      },

      // ========== KNOWLEDGE ==========
      TagValue: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
        required: ["id", "name"],
      },
      TagCategory: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          color: { type: "string" },
          allowCustom: { type: "boolean" },
          values: {
            type: "array",
            items: { $ref: "#/components/schemas/TagValue" },
          },
        },
        required: ["id", "name"],
      },
      TagCategoryCreate: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          color: { type: "string", default: "#6B7280" },
          allowCustom: { type: "boolean", default: false },
          values: {
            type: "array",
            items: { $ref: "#/components/schemas/TagValue" },
          },
        },
        required: ["id", "name"],
      },
      TagCategoryUpdate: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          color: { type: "string" },
          allowCustom: { type: "boolean" },
        },
      },
      EntityRelation: {
        type: "object",
        properties: {
          targetId: { type: "string" },
          type: { type: "string" },
        },
        required: ["targetId", "type"],
      },
      Entity: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: { type: "string" },
          name: { type: "string" },
          aliases: { type: "array", items: { type: "string" } },
          description: { type: "string" },
          content: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          relations: {
            type: "array",
            items: { $ref: "#/components/schemas/EntityRelation" },
          },
          metadata: { type: "object" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
        required: ["id", "type", "name", "createdAt", "updatedAt"],
      },
      EntityCreate: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: { type: "string" },
          name: { type: "string" },
          aliases: { type: "array", items: { type: "string" } },
          description: { type: "string" },
          content: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          relations: {
            type: "array",
            items: { $ref: "#/components/schemas/EntityRelation" },
          },
          metadata: { type: "object" },
        },
        required: ["id", "type", "name"],
      },
      EntityUpdate: {
        type: "object",
        properties: {
          type: { type: "string" },
          name: { type: "string" },
          aliases: { type: "array", items: { type: "string" } },
          description: { type: "string" },
          content: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          relations: {
            type: "array",
            items: { $ref: "#/components/schemas/EntityRelation" },
          },
          metadata: { type: "object" },
        },
      },
      KnowledgeConfig: {
        type: "object",
        properties: {
          tagCategories: {
            type: "array",
            items: { $ref: "#/components/schemas/TagCategory" },
          },
          entityTypes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                description: { type: "string" },
                icon: { type: "string" },
              },
              required: ["id", "name"],
            },
          },
        },
      },
      KnowledgeStats: {
        type: "object",
        properties: {
          totalEntities: { type: "integer" },
          byType: {
            type: "object",
            additionalProperties: { type: "integer" },
          },
          byTag: {
            type: "object",
            additionalProperties: { type: "integer" },
          },
        },
      },
    },
  },
};
