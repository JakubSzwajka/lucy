/**
 * Smart timestamp formatting for chat messages.
 */

export function formatMessageTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;

  const time = formatHHMM(date);

  if (isSameDay(date, now)) return time;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, yesterday)) return `Yesterday, ${time}`;

  // Same week (within 7 days)
  if (diffMs < 7 * 24 * 60 * 60 * 1000) {
    const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
    return `${dayName}, ${time}`;
  }

  // Older
  const monthDay = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${monthDay}, ${time}`;
}

export function formatGapTimestamp(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatHHMM(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}
