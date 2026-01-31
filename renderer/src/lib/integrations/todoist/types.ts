// ============================================================================
// Todoist API Response Types
// ============================================================================

export interface TodoistTask {
  id: string;
  content: string;
  description: string;
  project_id: string;
  section_id: string | null;
  parent_id: string | null;
  order: number;
  priority: number;
  due: {
    date: string;
    string: string;
    datetime?: string;
    timezone?: string;
    is_recurring: boolean;
  } | null;
  url: string;
  comment_count: number;
  created_at: string;
  creator_id: string;
  assignee_id: string | null;
  assigner_id: string | null;
  labels: string[];
  is_completed: boolean;
}

export interface TodoistProject {
  id: string;
  name: string;
  color: string;
  parent_id: string | null;
  order: number;
  comment_count: number;
  is_shared: boolean;
  is_favorite: boolean;
  is_inbox_project: boolean;
  is_team_inbox: boolean;
  view_style: "list" | "board";
  url: string;
}

export interface TodoistUser {
  id: string;
  name: string;
  email: string;
}

// ============================================================================
// API Request Types
// ============================================================================

export interface GetTasksParams {
  project_id?: string;
  filter?: string;
}
