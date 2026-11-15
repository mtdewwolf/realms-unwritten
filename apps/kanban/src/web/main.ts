import {
  SUGGESTED_TAGS,
  type Board,
  type Card,
  type Column,
  type Priority,
  filterBoard,
  isPriority,
  parseTags,
  priorityLabel,
  tagLabel,
} from "../domain";
import { renderMarkdown } from "./markdown";

type SessionInfo = { required: boolean; authenticated: boolean };
type DropSpot = { columnId: string; index: number };

const state = {
  board: { columns: [], cards: [] } as Board,
  query: "",
  tag: null as string | null,
  activeColumnId: null as string | null,
  editingId: null as string | null,
  draftTags: [] as string[],
  renamingId: null as string | null,
  deleteArmed: false,
};

const boot = document.querySelector<HTMLElement>("#boot");
const login = document.querySelector<HTMLElement>("#login");
const loginForm = document.querySelector<HTMLFormElement>("#login-form");
const loginError = document.querySelector<HTMLElement>("#login-error");
const app = document.querySelector<HTMLElement>("#app");
const logoutButton = document.querySelector<HTMLButtonElement>("#logout");
const search = document.querySelector<HTMLInputElement>("#search");
const tagFilters = document.querySelector<HTMLElement>("#tag-filters");
const devBanner = document.querySelector<HTMLElement>("#dev-banner");
const filterNote = document.querySelector<HTMLElement>("#filter-note");
const columnTabs = document.querySelector<HTMLElement>("#column-tabs");
const boardEl = document.querySelector<HTMLElement>("#board");
const newIdea = document.querySelector<HTMLButtonElement>("#new-idea");
const addColumn = document.querySelector<HTMLButtonElement>("#add-column");
const ideaDialog = document.querySelector<HTMLDialogElement>("#idea-dialog");
const ideaForm = document.querySelector<HTMLFormElement>("#idea-form");
const ideaHeading = document.querySelector<HTMLElement>("#idea-heading");
const ideaTitle = document.querySelector<HTMLInputElement>("#idea-title");
const ideaDescription = document.querySelector<HTMLTextAreaElement>("#idea-description");
const ideaPriority = document.querySelector<HTMLSelectElement>("#idea-priority");
const ideaColumn = document.querySelector<HTMLSelectElement>("#idea-column");
const columnField = document.querySelector<HTMLElement>("#column-field");
const ideaTags = document.querySelector<HTMLElement>("#idea-tags");
const tagInput = document.querySelector<HTMLInputElement>("#tag-input");
const tagAdd = document.querySelector<HTMLButtonElement>("#tag-add");
const ideaError = document.querySelector<HTMLElement>("#idea-error");
const ideaTimes = document.querySelector<HTMLElement>("#idea-times");
const ideaDelete = document.querySelector<HTMLButtonElement>("#idea-delete");
const ideaCancel = document.querySelector<HTMLButtonElement>("#idea-cancel");
const moveDialog = document.querySelector<HTMLDialogElement>("#move-dialog");
const moveActions = document.querySelector<HTMLElement>("#move-actions");
const moveCancel = document.querySelector<HTMLButtonElement>("#move-cancel");
const columnDialog = document.querySelector<HTMLDialogElement>("#column-dialog");
const columnForm = document.querySelector<HTMLFormElement>("#column-form");
const columnHeading = document.querySelector<HTMLElement>("#column-heading");
const columnName = document.querySelector<HTMLInputElement>("#column-name");
const columnError = document.querySelector<HTMLElement>("#column-error");
const columnCancel = document.querySelector<HTMLButtonElement>("#column-cancel");
const toast = document.querySelector<HTMLElement>("#toast");

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

function must<T extends Element>(element: T | null, name: string): T {
  if (!element) throw new Error(`Missing ${name}`);
  return element;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("content-type", "application/json");
  const response = await fetch(path, { ...init, headers });
  if (response.status === 204) return undefined as T;
  const body = await response.json() as { error?: string };
  if (response.status === 401 && path !== "/api/login") {
    showLogin("");
    throw new ApiError(body.error || "Sign in required.", 401);
  }
  if (!response.ok) throw new ApiError(body.error || "Request failed.", response.status);
  return body as T;
}

function showToast(message: string): void {
  const node = must(toast, "toast");
  node.textContent = message;
  window.setTimeout(() => {
    if (node.textContent === message) node.textContent = "";
  }, 4200);
}

function showLogin(message: string): void {
  must(boot, "boot").hidden = true;
  must(app, "app").hidden = true;
  must(login, "login").hidden = false;
  must(loginError, "login error").textContent = message;
}

function orderedColumns(): Column[] {
  return state.board.columns.slice().sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}

function orderedCards(columnId: string): Card[] {
  return state.board.cards
    .filter(card => card.columnId === columnId)
    .sort((a, b) => a.position - b.position);
}

function visibleCards(columnId: string): Card[] {
  return filterBoard(state.board, state.query, state.tag ?? "").cards
    .filter(card => card.columnId === columnId)
    .sort((a, b) => a.position - b.position);
}

function filtering(): boolean {
  return state.query.trim().length > 0 || state.tag !== null;
}

function activeColumnId(): string | null {
  const columns = orderedColumns();
  if (columns.some(column => column.id === state.activeColumnId)) return state.activeColumnId;
  return columns[0]?.id ?? null;
}

function formatWhen(ms: number): string {
  const delta = Date.now() - ms;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (delta < minute) return "just now";
  if (delta < hour) return `${Math.floor(delta / minute)}m ago`;
  if (delta < day) return `${Math.floor(delta / hour)}h ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(ms);
}

function fullWhen(card: Card): string {
  const format = (ms: number) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(ms);
  return `Created ${format(card.createdAt)}. Updated ${format(card.updatedAt)}.`;
}

async function refresh(): Promise<void> {
  state.board = await api<Board>("/api/board");
  render();
}

function render(): void {
  const columns = orderedColumns();
  const active = activeColumnId();
  state.activeColumnId = active;
  renderTagFilters();
  must(filterNote, "filter note").hidden = !filtering();
  renderTabs(columns, active);
  const boardScroll = must(boardEl, "board").scrollLeft;
  const scrolls = new Map<string, number>();
  document.querySelectorAll<HTMLElement>(".cards").forEach(node => {
    const id = node.closest<HTMLElement>(".column")?.dataset.id;
    if (id) scrolls.set(id, node.scrollTop);
  });
  const board = must(boardEl, "board");
  board.replaceChildren();
  if (columns.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Add a column to start the board.";
    board.append(empty);
    return;
  }
  for (const column of columns) board.append(renderColumn(column, column.id === active));
  board.scrollLeft = boardScroll;
  board.querySelectorAll<HTMLElement>(".cards").forEach(node => {
    const id = node.closest<HTMLElement>(".column")?.dataset.id;
    if (id && scrolls.has(id)) node.scrollTop = scrolls.get(id) ?? 0;
  });
}

function renderTagFilters(): void {
  const root = must(tagFilters, "tags");
  root.replaceChildren();
  const ids = new Set<string>(SUGGESTED_TAGS.map(tag => tag.id));
  for (const card of state.board.cards) for (const tag of card.tags) ids.add(tag);
  for (const id of ids) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tag-toggle";
    button.textContent = tagLabel(id);
    button.setAttribute("aria-pressed", String(state.tag === id));
    button.addEventListener("click", () => {
      state.tag = state.tag === id ? null : id;
      render();
    });
    root.append(button);
  }
}

function renderTabs(columns: Column[], active: string | null): void {
  const root = must(columnTabs, "tabs");
  root.replaceChildren();
  for (const column of columns) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tab";
    button.dataset.tab = column.id;
    button.textContent = `${column.name} ${visibleCards(column.id).length}`;
    button.setAttribute("aria-pressed", String(column.id === active));
    button.addEventListener("click", () => {
      state.activeColumnId = column.id;
      render();
    });
    root.append(button);
  }
}

function renderColumn(column: Column, active: boolean): HTMLElement {
  const section = document.createElement("section");
  section.className = `column${active ? " is-active" : ""}`;
  section.dataset.id = column.id;
  const head = document.createElement("div");
  head.className = "column-head";
  const titleWrap = document.createElement("div");
  titleWrap.className = "column-title";
  const title = document.createElement("h2");
  title.textContent = column.name;
  const count = document.createElement("span");
  count.className = "count";
  const cards = visibleCards(column.id);
  count.textContent = String(cards.length);
  titleWrap.append(title, count);
  const tools = document.createElement("div");
  tools.className = "column-tools";
  const rename = document.createElement("button");
  rename.type = "button";
  rename.textContent = "Rename";
  rename.addEventListener("click", () => openColumn(column));
  tools.append(rename);
  if (orderedCards(column.id).length === 0) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      void api(`/api/columns/${column.id}`, { method: "DELETE" }).then(refresh).catch(report);
    });
    tools.append(remove);
  }
  head.append(titleWrap, tools);
  const list = document.createElement("div");
  list.className = "cards";
  if (cards.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = filtering() ? "Nothing matches." : "Nothing here yet.";
    list.append(empty);
  }
  for (const card of cards) list.append(renderCard(card));
  section.append(head, list);
  return section;
}

function renderCard(card: Card): HTMLElement {
  const article = document.createElement("article");
  article.className = `card priority-${card.priority}`;
  article.dataset.id = card.id;
  const top = document.createElement("div");
  top.className = "card-top";
  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "drag";
  handle.textContent = "⋮⋮";
  handle.setAttribute("aria-label", `Drag ${card.title}. Press Enter to open move options.`);
  handle.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openMove(card.id);
  });
  bindDrag(handle, article, card.id);
  const heading = document.createElement("h3");
  heading.textContent = card.title;
  top.append(handle, heading);
  article.append(top);
  if (card.description) {
    const body = document.createElement("div");
    body.className = "card-body";
    body.innerHTML = renderMarkdown(card.description);
    article.append(body);
  }
  if (card.tags.length > 0) {
    const tags = document.createElement("ul");
    tags.className = "tags";
    for (const tag of card.tags) {
      const item = document.createElement("li");
      item.textContent = tagLabel(tag);
      tags.append(item);
    }
    article.append(tags);
  }
  const meta = document.createElement("p");
  meta.className = "meta";
  const priority = document.createElement("span");
  priority.className = "priority-name";
  priority.textContent = priorityLabel(card.priority);
  meta.append(priority, document.createTextNode(` · Updated ${formatWhen(card.updatedAt)}`));
  meta.title = fullWhen(card);
  const actions = document.createElement("div");
  actions.className = "card-actions";
  const edit = document.createElement("button");
  edit.type = "button";
  edit.textContent = "Edit";
  edit.addEventListener("click", () => openIdea(card));
  const move = document.createElement("button");
  move.type = "button";
  move.textContent = "Move";
  move.addEventListener("click", () => openMove(card.id));
  actions.append(edit, move);
  article.append(meta, actions);
  return article;
}

function bindDrag(handle: HTMLElement, card: HTMLElement, cardId: string): void {
  handle.addEventListener("pointerdown", event => {
    if (event.button !== 0 || filtering()) return;
    event.preventDefault();
    const pointerId = event.pointerId;
    try { handle.setPointerCapture(pointerId); } catch { /* Pointer capture is unavailable for this event. */ }
    const startX = event.clientX;
    const startY = event.clientY;
    let dragging = false;
    let ghost: HTMLElement | null = null;
    const finish = (commit: boolean, x: number, y: number) => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", cancel);
      ghost?.remove();
      clearDrop();
      card.classList.remove("is-dragging");
      if (!commit || !dragging) return;
      const spot = dropSpot(x, y, cardId);
      const current = currentIndex(cardId);
      const source = state.board.cards.find(item => item.id === cardId);
      if (!spot || !source || (spot.columnId === source.columnId && spot.index === current)) return;
      void moveCard(cardId, spot.columnId, spot.index);
    };
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 8) return;
      if (!dragging) {
        dragging = true;
        const width = card.getBoundingClientRect().width;
        card.classList.add("is-dragging");
        ghost = card.cloneNode(true) as HTMLElement;
        ghost.classList.remove("is-dragging");
        ghost.classList.add("drag-ghost");
        ghost.style.width = `${Math.max(width, 220)}px`;
        document.body.append(ghost);
      }
      if (ghost) {
        ghost.style.left = `${ev.clientX + 8}px`;
        ghost.style.top = `${ev.clientY + 8}px`;
      }
      markDrop(dropSpot(ev.clientX, ev.clientY, cardId));
    };
    const up = (ev: PointerEvent) => finish(true, ev.clientX, ev.clientY);
    const cancel = () => finish(false, 0, 0);
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", cancel);
  });
}

function currentIndex(cardId: string): number {
  const card = state.board.cards.find(item => item.id === cardId);
  if (!card) return -1;
  return orderedCards(card.columnId).findIndex(item => item.id === cardId);
}

function dropSpot(x: number, y: number, cardId: string): DropSpot | null {
  const columns = document.querySelectorAll<HTMLElement>(".column");
  for (const column of columns) {
    if (column.dataset.id === undefined) continue;
    const rect = column.getBoundingClientRect();
    if (rect.width === 0 || x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue;
    const cards = [...column.querySelectorAll<HTMLElement>(".card:not(.is-dragging)")];
    let index = cards.length;
    for (let i = 0; i < cards.length; i += 1) {
      const cardRect = cards[i]?.getBoundingClientRect();
      if (!cardRect) continue;
      if (y < cardRect.top + cardRect.height / 2) {
        index = i;
        break;
      }
    }
    return { columnId: column.dataset.id, index };
  }
  const tab = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-tab]");
  const columnId = tab?.dataset.tab;
  if (!columnId) return null;
  const count = orderedCards(columnId).length;
  const card = state.board.cards.find(item => item.id === cardId);
  const index = card?.columnId === columnId ? Math.max(0, count - 1) : count;
  return { columnId, index };
}

function clearDrop(): void {
  document.querySelectorAll(".drop-before, .drop-end, .is-drop").forEach(node => {
    node.classList.remove("drop-before", "drop-end", "is-drop");
  });
}

function markDrop(spot: DropSpot | null): void {
  clearDrop();
  if (!spot) return;
  const column = document.querySelector<HTMLElement>(`.column[data-id="${CSS.escape(spot.columnId)}"]`);
  const tab = document.querySelector<HTMLElement>(`[data-tab="${CSS.escape(spot.columnId)}"]`);
  tab?.classList.add("is-drop");
  if (!column) return;
  const cards = [...column.querySelectorAll<HTMLElement>(".card:not(.is-dragging)")];
  const target = cards[spot.index];
  if (target) target.classList.add("drop-before");
  else column.classList.add("drop-end");
}

async function moveCard(cardId: string, columnId: string, index: number): Promise<void> {
  await api(`/api/cards/${cardId}/move`, {
    method: "POST",
    body: JSON.stringify({ columnId, index }),
  });
  state.activeColumnId = columnId;
  await refresh();
}

function report(error: unknown): void {
  if (error instanceof ApiError && error.status === 401) return;
  showToast(error instanceof Error ? error.message : "Something went wrong.");
}

function openIdea(card: Card | null): void {
  state.editingId = card?.id ?? null;
  state.draftTags = card ? [...card.tags] : [];
  state.deleteArmed = false;
  must(ideaHeading, "idea heading").textContent = card ? "Edit idea" : "New idea";
  must(ideaTitle, "title").value = card?.title ?? "";
  must(ideaDescription, "description").value = card?.description ?? "";
  must(ideaPriority, "priority").value = card?.priority ?? "medium";
  const select = must(ideaColumn, "column");
  select.replaceChildren();
  for (const column of orderedColumns()) {
    const option = document.createElement("option");
    option.value = column.id;
    option.textContent = column.name;
    select.append(option);
  }
  select.value = card?.columnId ?? activeColumnId() ?? "";
  must(columnField, "column field").hidden = card !== null;
  must(ideaDelete, "delete").hidden = card === null;
  must(ideaDelete, "delete").textContent = "Delete";
  must(ideaError, "idea error").textContent = "";
  must(ideaTimes, "times").textContent = card ? fullWhen(card) : "";
  renderDraftTags();
  must(ideaDialog, "idea dialog").showModal();
  must(ideaTitle, "title").focus();
}

function renderDraftTags(): void {
  const root = must(ideaTags, "idea tags");
  root.replaceChildren();
  const ids = [...new Set<string>([...SUGGESTED_TAGS.map(tag => tag.id), ...state.draftTags])];
  for (const id of ids) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tag-toggle";
    button.textContent = tagLabel(id);
    button.setAttribute("aria-pressed", String(state.draftTags.includes(id)));
    button.addEventListener("click", () => toggleDraftTag(id));
    root.append(button);
  }
}

function toggleDraftTag(id: string): void {
  const next = state.draftTags.includes(id) ? state.draftTags.filter(tag => tag !== id) : [...state.draftTags, id];
  try {
    state.draftTags = parseTags(next);
    must(ideaError, "idea error").textContent = "";
    renderDraftTags();
  } catch (error) {
    must(ideaError, "idea error").textContent = error instanceof Error ? error.message : "Tag is not allowed.";
  }
}

function addDraftTag(): void {
  const raw = must(tagInput, "tag input").value;
  if (!raw.trim()) return;
  try {
    const [tag] = parseTags([raw]);
    if (!tag) return;
    state.draftTags = parseTags([...state.draftTags, tag]);
    must(tagInput, "tag input").value = "";
    must(ideaError, "idea error").textContent = "";
    renderDraftTags();
  } catch (error) {
    must(ideaError, "idea error").textContent = error instanceof Error ? error.message : "Tag is not allowed.";
  }
}

async function saveIdea(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const title = must(ideaTitle, "title").value;
  const description = must(ideaDescription, "description").value;
  const priorityValue = must(ideaPriority, "priority").value;
  if (!isPriority(priorityValue)) return;
  const priority: Priority = priorityValue;
  const payload = { title, description, tags: state.draftTags, priority };
  try {
    if (state.editingId) {
      await api(`/api/cards/${state.editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
    } else {
      const columnId = must(ideaColumn, "column").value;
      const created = await api<Card>("/api/cards", { method: "POST", body: JSON.stringify({ ...payload, columnId }) });
      state.activeColumnId = created.columnId;
    }
    must(ideaDialog, "idea dialog").close();
    await refresh();
  } catch (error) {
    if (error instanceof ApiError && error.status !== 401) must(ideaError, "idea error").textContent = error.message;
    else report(error);
  }
}

async function deleteIdea(): Promise<void> {
  const button = must(ideaDelete, "delete");
  if (!state.deleteArmed) {
    state.deleteArmed = true;
    button.textContent = "Delete this idea?";
    return;
  }
  if (!state.editingId) return;
  try {
    await api(`/api/cards/${state.editingId}`, { method: "DELETE" });
    must(ideaDialog, "idea dialog").close();
    await refresh();
  } catch (error) {
    report(error);
  }
}

function openMove(cardId: string): void {
  const card = state.board.cards.find(item => item.id === cardId);
  if (!card) return;
  const root = must(moveActions, "move actions");
  root.replaceChildren();
  const siblings = orderedCards(card.columnId);
  const index = siblings.findIndex(item => item.id === cardId);
  const add = (label: string, columnId: string, nextIndex: number, disabled = false) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.disabled = disabled;
    button.addEventListener("click", () => {
      must(moveDialog, "move dialog").close();
      void moveCard(cardId, columnId, nextIndex).catch(report);
    });
    root.append(button);
  };
  add("Move up", card.columnId, index - 1, index <= 0);
  add("Move down", card.columnId, index + 1, index === siblings.length - 1);
  for (const column of orderedColumns()) {
    if (column.id === card.columnId) continue;
    add(`Move to ${column.name}`, column.id, orderedCards(column.id).length);
  }
  must(moveDialog, "move dialog").showModal();
}

function openColumn(column: Column | null): void {
  state.renamingId = column?.id ?? null;
  must(columnHeading, "column heading").textContent = column ? "Rename column" : "New column";
  must(columnName, "column name").value = column?.name ?? "";
  must(columnError, "column error").textContent = "";
  must(columnDialog, "column dialog").showModal();
  must(columnName, "column name").focus();
}

async function saveColumn(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const name = must(columnName, "column name").value;
  try {
    if (state.renamingId) await api(`/api/columns/${state.renamingId}`, { method: "PATCH", body: JSON.stringify({ name }) });
    else await api("/api/columns", { method: "POST", body: JSON.stringify({ name }) });
    must(columnDialog, "column dialog").close();
    await refresh();
  } catch (error) {
    if (error instanceof ApiError && error.status !== 401) must(columnError, "column error").textContent = error.message;
    else report(error);
  }
}

function wire(): void {
  must(loginForm, "login").addEventListener("submit", event => {
    event.preventDefault();
    const password = document.querySelector<HTMLInputElement>("#password")?.value ?? "";
    void api("/api/login", { method: "POST", body: JSON.stringify({ password }) })
      .then(() => showBoard())
      .catch(error => {
        must(loginError, "login error").textContent = error instanceof Error ? error.message : "Could not sign in.";
      });
  });
  must(logoutButton, "logout").addEventListener("click", () => {
    void api("/api/logout", { method: "POST" }).then(() => showLogin("")).catch(report);
  });
  must(search, "search").addEventListener("input", () => {
    state.query = must(search, "search").value;
    render();
  });
  must(newIdea, "new idea").addEventListener("click", () => openIdea(null));
  must(addColumn, "add column").addEventListener("click", () => openColumn(null));
  must(ideaForm, "idea form").addEventListener("submit", event => void saveIdea(event));
  must(ideaCancel, "cancel idea").addEventListener("click", () => must(ideaDialog, "idea dialog").close());
  must(ideaDelete, "delete").addEventListener("click", () => void deleteIdea());
  must(tagAdd, "add tag").addEventListener("click", addDraftTag);
  must(tagInput, "tag input").addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== ",") return;
    event.preventDefault();
    addDraftTag();
  });
  must(moveCancel, "move cancel").addEventListener("click", () => must(moveDialog, "move dialog").close());
  must(columnForm, "column form").addEventListener("submit", event => void saveColumn(event));
  must(columnCancel, "column cancel").addEventListener("click", () => must(columnDialog, "column dialog").close());
  for (const dialog of [ideaDialog, moveDialog, columnDialog]) {
    dialog?.addEventListener("click", event => {
      if (event.target === dialog) dialog.close();
    });
  }
}

async function showBoard(): Promise<void> {
  must(boot, "boot").hidden = true;
  must(login, "login").hidden = true;
  must(app, "app").hidden = false;
  await refresh();
}

async function start(): Promise<void> {
  wire();
  const session = await api<SessionInfo>("/api/session");
  must(devBanner, "banner").hidden = session.required;
  must(logoutButton, "logout").hidden = !session.required;
  if (session.required && !session.authenticated) showLogin("");
  else await showBoard();
}

void start().catch(error => {
  must(boot, "boot").textContent = error instanceof Error ? error.message : "The board could not open.";
});
