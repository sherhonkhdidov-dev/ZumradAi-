// Markdown -> xavfsiz HTML, kod bloklarini bo'yash va fayllarga ajratish.

import { marked } from "../vendor/marked.esm.js";
import DOMPurify from "../vendor/purify.es.mjs";
import hljs from "../vendor/hljs.js";
import { escapeHtml, icon } from "./util.js";

const EXT = {
  html: "html", xml: "xml", css: "css", scss: "scss", javascript: "js", js: "js", jsx: "jsx", typescript: "ts", ts: "ts", tsx: "tsx",
  python: "py", py: "py", json: "json", bash: "sh", sh: "sh", shell: "sh", sql: "sql", java: "java", c: "c", cpp: "cpp", csharp: "cs",
  cs: "cs", go: "go", rust: "rs", php: "php", kotlin: "kt", swift: "swift", yaml: "yml", yml: "yml", markdown: "md", md: "md",
  svg: "svg", ruby: "rb", dart: "dart", toml: "toml", ini: "ini", text: "txt", plaintext: "txt", diff: "diff",
};
const DEFAULT_NAME = { html: "index.html", css: "style.css", javascript: "script.js", js: "script.js" };

/** "html:index.html" | "python app/main.py" -> {lang, file} */
export function parseInfo(info = "") {
  const s = String(info).trim();
  const m = /^([\w+#.-]*)(?:[:\s]+(.+))?$/.exec(s);
  if (!m) return { lang: "", file: "" };
  let file = (m[2] || "").trim().replace(/^["'`]|["'`]$/g, "");
  if (/\s/.test(file)) file = file.split(/\s+/)[0];
  return { lang: (m[1] || "").toLowerCase(), file };
}

function langKey(lang) {
  const l = (lang || "").toLowerCase();
  if (l === "htm") return "html";
  return l;
}

function uniqueName(name, used) {
  if (!used.has(name)) return name;
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let i = 2;
  while (used.has(`${base}-${i}${ext}`)) i++;
  return `${base}-${i}${ext}`;
}

/** Xabar matnidagi barcha kod bloklarini fayllar ro'yxatiga aylantiradi. */
export function collectFiles(markdown) {
  const files = [];
  const used = new Set();
  let n = 0;
  for (const tok of marked.lexer(String(markdown || ""))) {
    if (tok.type !== "code") continue;
    const { lang, file } = parseInfo(tok.lang);
    const lk = langKey(lang);
    n++;
    let name = file || DEFAULT_NAME[lk] || `fayl-${n}.${EXT[lk] || "txt"}`;
    name = uniqueName(name, used);
    used.add(name);
    files.push({ name, lang: lk, code: tok.text.replace(/\n$/, ""), index: n - 1 });
  }
  return files;
}

export function isPreviewable(file) {
  if (!file) return false;
  if (/\.(html?|svg)$/i.test(file.name) || file.lang === "html" || file.lang === "svg") return true;
  return file.lang === "xml" && /<!doctype html|<html/i.test(file.code);
}

let blockCounter = 0;

marked.use({
  gfm: true,
  breaks: false,
  renderer: {
    code(token) {
      const { lang, file } = parseInfo(token.lang);
      const lk = langKey(lang);
      let html;
      try {
        html = hljs.getLanguage(lk) ? hljs.highlight(token.text, { language: lk, ignoreIllegals: true }).value : escapeHtml(token.text);
      } catch {
        html = escapeHtml(token.text);
      }
      const idx = blockCounter++;
      return `<div class="codeblock" data-index="${idx}" data-lang="${escapeHtml(lk)}" data-file="${escapeHtml(file)}"><pre><code class="hljs">${html}</code></pre></div>`;
    },
    table(token) {
      // standart jadval HTML'ini o'ramaymiz (gorizontal skroll uchun)
      const header = token.header.map((c, i) => `<th${token.align[i] ? ` align="${token.align[i]}"` : ""}>${this.parser.parseInline(c.tokens)}</th>`).join("");
      const rows = token.rows
        .map((r) => `<tr>${r.map((c, i) => `<td${token.align[i] ? ` align="${token.align[i]}"` : ""}>${this.parser.parseInline(c.tokens)}</td>`).join("")}</tr>`)
        .join("");
      return `<div class="table-wrap"><table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>`;
    },
  },
});

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer nofollow");
  }
});

const PURIFY = {
  FORBID_TAGS: ["img", "style", "form", "input", "iframe", "script", "svg", "math", "button", "textarea", "select"],
  FORBID_ATTR: ["style", "srcset"],
  ALLOW_DATA_ATTR: true,
};

export function renderMarkdown(text) {
  blockCounter = 0;
  const raw = marked.parse(String(text || ""));
  return DOMPurify.sanitize(raw, PURIFY);
}

/** Bo'yalgan HTML ustiga tugmalar va manba havolalarini qo'shadi (ishonchli kod bilan). */
export function decorate(container, { sources = [] } = {}) {
  container.querySelectorAll(".codeblock").forEach((block) => {
    if (block.querySelector(".cb-head")) return;
    const lang = block.dataset.lang;
    const file = block.dataset.file;
    const head = document.createElement("div");
    head.className = "cb-head";
    const label = file || lang || "kod";
    head.innerHTML = `<span class="cb-name">${icon("file", "sm")}<span>${escapeHtml(label)}</span></span><span class="cb-actions">
      <button type="button" class="cb-btn" data-act="preview" hidden>${icon("eye", "sm")}<span>Ko‘rish</span></button>
      <button type="button" class="cb-btn" data-act="copy" aria-label="Nusxa olish">${icon("copy", "sm")}<span>Nusxa</span></button>
      <button type="button" class="cb-btn" data-act="download" aria-label="Yuklab olish">${icon("download", "sm")}</button>
    </span>`;
    block.prepend(head);
    if (lang === "html" || lang === "svg" || /\.(html?|svg)$/i.test(file) || (lang === "xml" && /<!doctype html|<html/i.test(block.textContent))) {
      head.querySelector('[data-act="preview"]').hidden = false;
    }
  });

  if (sources.length) linkCitations(container, sources);
}

function linkCitations(container, sources) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!/\[\d{1,2}\]/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
      return n.parentElement.closest("pre, code, a, .codeblock") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const frag = document.createDocumentFragment();
    node.nodeValue.split(/(\[\d{1,2}\])/).forEach((part) => {
      const m = /^\[(\d{1,2})\]$/.exec(part);
      const src = m && sources[Number(m[1]) - 1];
      if (src) {
        const a = document.createElement("a");
        a.className = "cite";
        a.href = src.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer nofollow";
        a.title = src.title;
        a.textContent = m[1];
        frag.appendChild(a);
      } else if (part) {
        frag.appendChild(document.createTextNode(part));
      }
    });
    node.replaceWith(frag);
  }
}
