import { randomUUID } from "node:crypto";
import type { Database } from "bun:sqlite";
import {
  DEFAULT_COLUMNS,
  type Board,
  type Card,
  type Column,
  type Priority,
  filterBoard,
  isPriority,
} from "./domain";

export class BoardError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "BoardError";
  }
}

type ColumnRow = {
  id: string;
  name: string;
  position: number;
  created_at: number;
  updated_at: number;
};

type CardRow = {
  id: string;
  column_id: string;
  title: string;
  description: string;
  tags: string;
  priority: string;
  position: number;
  created_at: number;
  updated_at: number;
};

function columnFrom(row: ColumnRow): Column {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function cardFrom(row: CardRow): Card {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(row.tags) as unknown;
    if (Array.isArray(parsed)) tags = parsed.filter((tag): tag is string => typeof tag === "string");
  } catch {
    tags = [];
  }
  const priority: Priority = isPriority(row.priority) ? row.priority : "medium";
  return {
    id: row.id,
    columnId: row.column_id,
    title: row.title,
    description: row.description,
    tags,
    priority,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class BoardStore {
  private readonly columnsQuery;
  private readonly cardsQuery;

  constructor(private readonly db: Database) {
    db.exec(`CREATE TABLE IF NOT EXISTS columns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      position INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      column_id TEXT NOT NULL REFERENCES columns(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      tags TEXT NOT NULL,
      priority TEXT NOT NULL,
      position INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`);
    db.exec("CREATE INDEX IF NOT EXISTS cards_column_position ON cards(column_id, position)");
    this.columnsQuery = db.query<ColumnRow, []>("SELECT id, name, position, created_at, updated_at FROM columns ORDER BY position, name");
    this.cardsQuery = db.query<CardRow, []>("SELECT id, column_id, title, description, tags, priority, position, created_at, updated_at FROM cards");
    if (this.columnRows().length === 0) {
      for (const name of DEFAULT_COLUMNS) this.insertColumn(name);
    }
  }

  board(query = "", tag = ""): Board {
    const columns = this.columnRows().map(columnFrom);
    const order = new Map(columns.map(column => [column.id, column.position]));
    const cards = this.cardRows()
      .map(cardFrom)
      .sort((a, b) => (order.get(a.columnId) ?? 0) - (order.get(b.columnId) ?? 0) || a.position - b.position);
    return filterBoard({ columns, cards }, query, tag);
  }

  addColumn(name: string): Column {
    return columnFrom(this.insertColumn(name));
  }

  renameColumn(id: string, name: string): Column {
    const existing = this.mustColumn(id);
    const updatedAt = Math.max(Date.now(), existing.updated_at + 1);
    this.db.query("UPDATE columns SET name = ?, updated_at = ? WHERE id = ?").run(name, updatedAt, id);
    return columnFrom(this.mustColumn(id));
  }

  deleteColumn(id: string): void {
    this.mustColumn(id);
    if (this.cardsIn(id).length > 0) {
      throw new BoardError("Move or delete the ideas in this column first.", 409);
    }
    this.db.query("DELETE FROM columns WHERE id = ?").run(id);
  }

  addCard(input: { columnId: string; title: string; description: string; tags: string[]; priority: Priority }): Card {
    this.mustColumn(input.columnId);
    const now = Date.now();
    const id = randomUUID();
    const position = this.cardsIn(input.columnId).length;
    this.db.query(
      "INSERT INTO cards (id, column_id, title, description, tags, priority, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(id, input.columnId, input.title, input.description, JSON.stringify(input.tags), input.priority, position, now, now);
    return cardFrom(this.mustCard(id));
  }

  updateCard(id: string, patch: { title?: string; description?: string; tags?: string[]; priority?: Priority }): Card {
    const existing = cardFrom(this.mustCard(id));
    const updatedAt = Math.max(Date.now(), existing.updatedAt + 1);
    this.db.query(
      "UPDATE cards SET title = ?, description = ?, tags = ?, priority = ?, updated_at = ? WHERE id = ?",
    ).run(
      patch.title ?? existing.title,
      patch.description ?? existing.description,
      JSON.stringify(patch.tags ?? existing.tags),
      patch.priority ?? existing.priority,
      updatedAt,
      id,
    );
    return cardFrom(this.mustCard(id));
  }

  deleteCard(id: string): void {
    const existing = this.mustCard(id);
    this.db.transaction(() => {
      this.db.query("DELETE FROM cards WHERE id = ?").run(id);
      this.renumber(existing.column_id);
    })();
  }

  moveCard(id: string, columnId: string, index: number): Card {
    const existing = this.mustCard(id);
    this.mustColumn(columnId);
    const now = Math.max(Date.now(), existing.updated_at + 1);
    this.db.transaction(() => {
      const siblings = this.cardsIn(columnId).filter(card => card.id !== id);
      const at = Math.min(index, siblings.length);
      siblings.splice(at, 0, existing);
      const update = this.db.query("UPDATE cards SET column_id = ?, position = ?, updated_at = ? WHERE id = ?");
      siblings.forEach((card, position) => {
        update.run(columnId, position, card.id === id ? now : card.updated_at, card.id);
      });
      if (existing.column_id !== columnId) this.renumber(existing.column_id);
    })();
    return cardFrom(this.mustCard(id));
  }

  private insertColumn(name: string): ColumnRow {
    const now = Date.now();
    const id = randomUUID();
    const position = this.columnRows().reduce((max, column) => Math.max(max, column.position), -1) + 1;
    this.db.query("INSERT INTO columns (id, name, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
      id,
      name,
      position,
      now,
      now,
    );
    return this.mustColumn(id);
  }

  private renumber(columnId: string): void {
    const update = this.db.query("UPDATE cards SET position = ? WHERE id = ?");
    this.cardsIn(columnId).forEach((card, position) => update.run(position, card.id));
  }

  private columnRows(): ColumnRow[] {
    return this.columnsQuery.all();
  }

  private cardRows(): CardRow[] {
    return this.cardsQuery.all();
  }

  private cardsIn(columnId: string): CardRow[] {
    return this.cardRows()
      .filter(card => card.column_id === columnId)
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  }

  private mustColumn(id: string): ColumnRow {
    const row = this.columnRows().find(column => column.id === id);
    if (!row) throw new BoardError("Column not found.", 404);
    return row;
  }

  private mustCard(id: string): CardRow {
    const row = this.cardRows().find(card => card.id === id);
    if (!row) throw new BoardError("Idea not found.", 404);
    return row;
  }
}
