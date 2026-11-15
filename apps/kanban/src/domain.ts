export const PRIORITIES = ["low", "medium", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const SUGGESTED_TAGS = [
  { id: "combat", label: "combat" },
  { id: "art", label: "art" },
  { id: "quests", label: "quests" },
  { id: "crafting", label: "crafting" },
  { id: "world", label: "world" },
  { id: "ui", label: "UI" },
  { id: "bug", label: "bug" },
] as const;

export const DEFAULT_COLUMNS = ["Ideas", "Planned", "In Progress", "Done"] as const;

export const LIMITS = {
  title: 160,
  description: 20_000,
  columnName: 48,
  tags: 8,
  tagLength: 24,
  search: 200,
} as const;

export type Column = {
  id: string;
  name: string;
  position: number;
  createdAt: number;
  updatedAt: number;
};

export type Card = {
  id: string;
  columnId: string;
  title: string;
  description: string;
  tags: string[];
  priority: Priority;
  position: number;
  createdAt: number;
  updatedAt: number;
};

export type Board = {
  columns: Column[];
  cards: Card[];
};

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isPriority(value: unknown): value is Priority {
  return typeof value === "string" && (PRIORITIES as readonly string[]).includes(value);
}

export function tagLabel(id: string): string {
  const known = SUGGESTED_TAGS.find(tag => tag.id === id);
  return known?.label ?? id;
}

export function priorityLabel(priority: Priority): string {
  switch (priority) {
    case "low":
      return "Low";
    case "medium":
      return "Medium";
    case "high":
      return "High";
    default: {
      const neverPriority: never = priority;
      return neverPriority;
    }
  }
}

export function parseTitle(value: unknown): string {
  if (typeof value !== "string") throw new InputError("Title is required.");
  const title = value.trim();
  if (!title) throw new InputError("Title is required.");
  if (title.length > LIMITS.title) throw new InputError("Title is too long.");
  return title;
}

export function parseColumnName(value: unknown): string {
  if (typeof value !== "string") throw new InputError("Column name is required.");
  const name = value.trim();
  if (!name) throw new InputError("Column name is required.");
  if (name.length > LIMITS.columnName) throw new InputError("Column name is too long.");
  return name;
}

export function parseDescription(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value !== "string") throw new InputError("Description must be text.");
  if (value.length > LIMITS.description) throw new InputError("Description is too long.");
  return value.replace(/\r\n/g, "\n").trim();
}

export function parseTags(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new InputError("Tags must be a list.");
  if (value.length > LIMITS.tags) throw new InputError("Too many tags.");
  const tags: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") throw new InputError("Tags must be text.");
    const tag = entry.trim().toLowerCase();
    if (!tag) continue;
    if (tag.length > LIMITS.tagLength || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag)) {
      throw new InputError("Tags must be short words like combat, world, or ui.");
    }
    if (!tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

export function parsePriority(value: unknown, fallback: Priority = "medium"): Priority {
  if (value === undefined) return fallback;
  if (!isPriority(value)) throw new InputError("Priority must be low, medium, or high.");
  return value;
}

export function parseIndex(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new InputError("Index must be a non-negative integer.");
  }
  return value;
}

export function filterBoard(board: Board, query: string, tag: string): Board {
  const needle = query.trim().toLowerCase();
  const wanted = tag.trim().toLowerCase();
  return {
    columns: board.columns,
    cards: board.cards.filter(card => {
      if (wanted && !card.tags.includes(wanted)) return false;
      if (!needle) return true;
      const haystack = `${card.title}\n${card.description}\n${card.tags.join(" ")}`.toLowerCase();
      return haystack.includes(needle);
    }),
  };
}
