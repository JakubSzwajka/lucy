/**
 * Todoist task as returned by the API
 */
export interface TodoistTask {
  id: string;
  content: string;
  description?: string;
  priority: 1 | 2 | 3 | 4; // 1 = normal, 4 = urgent
  due?: {
    date: string;
    datetime?: string;
    string?: string;
    timezone?: string;
  };
  labels?: string[];
  project_id?: string;
  project_name?: string;
  section_id?: string;
  parent_id?: string;
  is_completed?: boolean;
  url?: string;
  created_at?: string;
  creator_id?: string;
  assignee_id?: string;
  assigner_id?: string;
  comment_count?: number;
  order?: number;
}

/**
 * Parsed task for UI display
 */
export interface ParsedTask {
  id: string;
  content: string;
  description?: string;
  priority: 1 | 2 | 3 | 4;
  dueDate?: Date;
  dueDateString?: string;
  isOverdue: boolean;
  isDueToday: boolean;
  isDueSoon: boolean; // Within 3 days
  labels: string[];
  projectName?: string;
  url?: string;
  isCompleted: boolean;
}

/**
 * Data structure for the TodoistTaskList component
 */
export interface TodoistTaskListData {
  tasks: ParsedTask[];
  filter?: string;
  total?: number;
  rawResponse?: string;
}

/**
 * Action types for Todoist tasks
 */
export type TodoistTaskAction =
  | { type: "complete"; taskId: string }
  | { type: "uncomplete"; taskId: string }
  | { type: "reschedule"; taskId: string; date: string }
  | { type: "open"; taskId: string; url?: string };
