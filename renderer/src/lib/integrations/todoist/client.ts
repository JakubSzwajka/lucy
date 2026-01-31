/**
 * Todoist API Client
 *
 * Provides task and project management via Todoist REST API.
 */

import type {
  TodoistTask,
  TodoistProject,
  TodoistUser,
  GetTasksParams,
} from "./types";

const BASE_URL = "https://api.todoist.com/rest/v2";

export class TodoistClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Todoist API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    // Some endpoints return 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // ============================================================================
  // User
  // ============================================================================

  /**
   * Get current user info (useful for testing connection)
   */
  async getUser(): Promise<TodoistUser> {
    // The REST API v2 doesn't have a direct user endpoint,
    // but we can use the Sync API for this
    const response = await fetch("https://api.todoist.com/sync/v9/sync", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "sync_token=*&resource_types=[\"user\"]",
    });

    if (!response.ok) {
      throw new Error(`Todoist API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      id: data.user.id,
      name: data.user.full_name,
      email: data.user.email,
    };
  }

  // ============================================================================
  // Tasks
  // ============================================================================

  /**
   * Get all tasks, optionally filtered
   */
  async getTasks(params?: GetTasksParams): Promise<TodoistTask[]> {
    const searchParams = new URLSearchParams();

    if (params?.project_id) {
      searchParams.set("project_id", params.project_id);
    }
    if (params?.filter) {
      searchParams.set("filter", params.filter);
    }

    const query = searchParams.toString();
    const endpoint = query ? `/tasks?${query}` : "/tasks";

    return this.request<TodoistTask[]>(endpoint);
  }

  /**
   * Get a single task by ID
   */
  async getTask(taskId: string): Promise<TodoistTask> {
    return this.request<TodoistTask>(`/tasks/${taskId}`);
  }

  // ============================================================================
  // Projects
  // ============================================================================

  /**
   * Get all projects
   */
  async getProjects(): Promise<TodoistProject[]> {
    return this.request<TodoistProject[]>("/projects");
  }

  /**
   * Get a single project by ID
   */
  async getProject(projectId: string): Promise<TodoistProject> {
    return this.request<TodoistProject>(`/projects/${projectId}`);
  }
}
