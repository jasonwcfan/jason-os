import { formatDistanceToNow, format, isPast, isToday } from "date-fns";

export function relativeTime(date: string | null): string {
  if (!date) return "never";
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function shortDate(date: string | null): string {
  if (!date) return "—";
  return format(new Date(date), "MMM d, yyyy");
}

export function dateTime(date: string | null): string {
  if (!date) return "—";
  return format(new Date(date), "MMM d, yyyy · h:mm a");
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function dueStatus(date: string): "overdue" | "today" | "upcoming" {
  const d = new Date(date + "T00:00:00");
  if (isToday(d)) return "today";
  if (isPast(d)) return "overdue";
  return "upcoming";
}
