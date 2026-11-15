function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeHref(href: string): string | null {
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const url = new URL(href);
    if (url.protocol === "http:" || url.protocol === "https:") return url.href;
  } catch {
    return null;
  }
  return null;
}

function inline(raw: string): string {
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[([^\]]+)\]\(([^)\s]+)\))/g;
  const parts: string[] = [];
  let last = 0;
  for (const match of raw.matchAll(pattern)) {
    const index = match.index ?? 0;
    parts.push(escapeHtml(raw.slice(last, index)));
    if (match[1]) parts.push(`<code>${escapeHtml(match[1].slice(1, -1))}</code>`);
    else if (match[2]) parts.push(`<strong>${escapeHtml(match[2].slice(2, -2))}</strong>`);
    else if (match[3]) parts.push(`<em>${escapeHtml(match[3].slice(1, -1))}</em>`);
    else {
      const label = escapeHtml(match[5] ?? "");
      const href = safeHref(match[6] ?? "");
      parts.push(href ? `<a href="${escapeHtml(href)}" rel="noreferrer">${label}</a>` : label);
    }
    last = index + match[0].length;
  }
  parts.push(escapeHtml(raw.slice(last)));
  return parts.join("");
}

export function renderMarkdown(source: string): string {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const html: string[] = [];
  let list: string[] | null = null;
  const flushList = () => {
    if (!list) return;
    html.push(`<ul>${list.map(item => `<li>${inline(item)}</li>`).join("")}</ul>`);
    list = null;
  };
  for (const line of lines) {
    const item = /^[-*] (.*)$/.exec(line);
    if (item) {
      list ??= [];
      list.push(item[1] ?? "");
      continue;
    }
    flushList();
    if (line.trim() === "") continue;
    const heading = /^(#{1,3}) (.*)$/.exec(line);
    if (heading) {
      html.push(`<p class="md-h">${inline(heading[2] ?? "")}</p>`);
      continue;
    }
    html.push(`<p>${inline(line)}</p>`);
  }
  flushList();
  return html.join("");
}
