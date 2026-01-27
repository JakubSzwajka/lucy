import type { TodoistTask, ParsedTask, TodoistTaskListData } from "./types";

/**
 * Parse a Todoist tool result into structured data
 * Handles both JSON responses and text preview formats
 */
export function parseTodoistResult(result: string): TodoistTaskListData {
  // Try JSON first
  try {
    const parsed = JSON.parse(result);

    // If it's an array of tasks
    if (Array.isArray(parsed)) {
      return {
        tasks: parsed.map(parseTask),
        total: parsed.length,
      };
    }

    // If it's an object with tasks array
    if (parsed.tasks && Array.isArray(parsed.tasks)) {
      return {
        tasks: parsed.tasks.map(parseTask),
        filter: parsed.filter,
        total: parsed.total ?? parsed.tasks.length,
      };
    }

    // If it's a single task
    if (parsed.id && parsed.content) {
      return {
        tasks: [parseTask(parsed)],
        total: 1,
      };
    }
  } catch {
    // Not JSON, try text parsing
  }

  // Try text format parsing
  // Format: "emoji content • due DATE • P# • id=ID"
  return parseTextFormat(result);
}

/**
 * Parse a single Todoist task from API format to UI format
 */
function parseTask(task: TodoistTask): ParsedTask {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let dueDate: Date | undefined;
  let isOverdue = false;
  let isDueToday = false;
  let isDueSoon = false;

  if (task.due) {
    const dueDateStr = task.due.datetime || task.due.date;
    dueDate = new Date(dueDateStr);

    const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    const diffDays = Math.floor((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    isOverdue = diffDays < 0;
    isDueToday = diffDays === 0;
    isDueSoon = diffDays >= 0 && diffDays <= 3;
  }

  return {
    id: task.id,
    content: task.content,
    description: task.description,
    priority: task.priority || 4,
    dueDate,
    dueDateString: task.due?.string || task.due?.date,
    isOverdue,
    isDueToday,
    isDueSoon,
    labels: task.labels || [],
    projectName: task.project_name,
    url: task.url,
    isCompleted: task.is_completed || false,
  };
}

/**
 * Parse text format output from Todoist MCP
 * Example line: "📄 wystaw fakturę • due 2026-01-27 • P4 • id=abc123"
 */
function parseTextFormat(text: string): TodoistTaskListData {
  const lines = text.split("\n");
  const tasks: ParsedTask[] = [];
  let filter: string | undefined;

  for (const line of lines) {
    // Check for filter info
    if (line.includes("Filter:")) {
      filter = line.replace("Filter:", "").trim();
      continue;
    }

    // Skip header lines
    if (line.includes("tasks") && (line.includes("limit") || line.includes("total"))) {
      continue;
    }
    if (line.includes("Preview:")) {
      continue;
    }

    // Try to parse task line
    const task = parseTaskLine(line.trim());
    if (task) {
      tasks.push(task);
    }
  }

  return {
    tasks,
    filter,
    total: tasks.length,
    rawResponse: text,
  };
}

/**
 * Parse a single task line from text format
 */
function parseTaskLine(line: string): ParsedTask | null {
  if (!line || line.length < 5) return null;

  // Extract ID (required)
  const idMatch = line.match(/id=([a-zA-Z0-9]+)/);
  if (!idMatch) return null;
  const id = idMatch[1];

  // Extract priority
  const priorityMatch = line.match(/P([1-4])/);
  const priority = priorityMatch ? (parseInt(priorityMatch[1]) as 1 | 2 | 3 | 4) : 4;

  // Extract due date
  const dueMatch = line.match(/due\s+(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2})?)/);
  let dueDate: Date | undefined;
  let dueDateString: string | undefined;
  let isOverdue = false;
  let isDueToday = false;
  let isDueSoon = false;

  if (dueMatch) {
    dueDateString = dueMatch[1];
    dueDate = new Date(dueDateString);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    const diffDays = Math.floor((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    isOverdue = diffDays < 0;
    isDueToday = diffDays === 0;
    isDueSoon = diffDays >= 0 && diffDays <= 3;
  }

  // Extract content (everything before the first •)
  let content = line.split("•")[0].trim();

  // Remove leading emoji if present (common Todoist patterns)
  content = content.replace(/^[\p{Emoji}\s]+/u, "").trim();

  // If content is empty, try to get it differently
  if (!content) {
    // Take everything before "due" or "P1-4"
    const contentMatch = line.match(/^(.+?)(?:\s+•\s+due|\s+•\s+P[1-4])/);
    if (contentMatch) {
      content = contentMatch[1].replace(/^[\p{Emoji}\s]+/u, "").trim();
    }
  }

  // Handle markdown links in content: [text](url)
  const linkMatch = content.match(/\[([^\]]+)\]\(([^)]+)\)/);
  let url: string | undefined;
  if (linkMatch) {
    content = linkMatch[1];
    url = linkMatch[2];
  }

  if (!content) return null;

  return {
    id,
    content,
    priority,
    dueDate,
    dueDateString,
    isOverdue,
    isDueToday,
    isDueSoon,
    labels: [],
    url,
    isCompleted: false,
  };
}
