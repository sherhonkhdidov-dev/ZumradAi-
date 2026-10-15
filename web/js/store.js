// Saqlash: suhbatlar va media (rasm/video) — IndexedDB; sozlamalar — localStorage.
// IndexedDB mavjud bo'lmasa (masalan, ba'zi maxfiy rejimlar), xotirada ishlaydi.

const DB_NAME = "zumrad-ai";
const DB_VERSION = 1;

let dbPromise = null;
const memory = { chats: new Map(), media: new Map() };
let memoryMode = false;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (!("indexedDB" in window)) {
      memoryMode = true;
      return resolve(null);
    }
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      memoryMode = true;
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("chats")) db.createObjectStore("chats", { keyPath: "id" });
      if (!db.objectStoreNames.contains("media")) db.createObjectStore("media");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      memoryMode = true;
      resolve(null);
    };
    req.onblocked = () => {
      memoryMode = true;
      resolve(null);
    };
  });
  return dbPromise;
}

function tx(db, store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    const r = fn(s);
    if (r) r.onsuccess = () => (result = r.result);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const isMemoryMode = () => memoryMode;

export async function loadChats() {
  const db = await openDb();
  if (!db) return [...memory.chats.values()].sort((a, b) => b.updated - a.updated);
  const all = (await tx(db, "chats", "readonly", (s) => s.getAll())) || [];
  return all.sort((a, b) => b.updated - a.updated);
}

export async function saveChat(chat) {
  chat.updated = Date.now();
  const clean = JSON.parse(JSON.stringify(chat)); // faqat oddiy ma'lumot
  const db = await openDb();
  if (!db) return void memory.chats.set(chat.id, clean);
  try {
    await tx(db, "chats", "readwrite", (s) => s.put(clean));
  } catch {
    memory.chats.set(chat.id, clean);
  }
}

export async function deleteChat(chat) {
  const mediaIds = collectMediaIds(chat);
  const db = await openDb();
  if (!db) {
    memory.chats.delete(chat.id);
    mediaIds.forEach((id) => memory.media.delete(id));
    return;
  }
  await tx(db, "chats", "readwrite", (s) => s.delete(chat.id));
  for (const id of mediaIds) await deleteMedia(id);
}

export function collectMediaIds(chat) {
  const ids = [];
  for (const m of chat.messages || []) {
    (m.attachments || []).forEach((a) => a.mediaId && ids.push(a.mediaId));
    if (m.image?.mediaId) ids.push(m.image.mediaId);
    if (m.video?.mediaId) ids.push(m.video.mediaId);
    (m.video?.scenes || []).forEach((s) => s.mediaId && ids.push(s.mediaId));
  }
  return ids;
}

const urlCache = new Map();

export async function putMedia(id, blob) {
  const db = await openDb();
  if (!db) memory.media.set(id, blob);
  else {
    try {
      await tx(db, "media", "readwrite", (s) => s.put(blob, id));
    } catch {
      memory.media.set(id, blob);
    }
  }
  urlCache.delete(id);
}

export async function getMedia(id) {
  if (memory.media.has(id)) return memory.media.get(id);
  const db = await openDb();
  if (!db) return null;
  return (await tx(db, "media", "readonly", (s) => s.get(id))) || null;
}

export async function mediaUrl(id) {
  if (!id) return null;
  if (urlCache.has(id)) return urlCache.get(id);
  const blob = await getMedia(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

export async function deleteMedia(id) {
  memory.media.delete(id);
  const u = urlCache.get(id);
  if (u) URL.revokeObjectURL(u);
  urlCache.delete(id);
  const db = await openDb();
  if (db) await tx(db, "media", "readwrite", (s) => s.delete(id)).catch(() => {});
}

export async function clearAll() {
  memory.chats.clear();
  memory.media.clear();
  urlCache.forEach((u) => URL.revokeObjectURL(u));
  urlCache.clear();
  const db = await openDb();
  if (!db) return;
  await tx(db, "chats", "readwrite", (s) => s.clear());
  await tx(db, "media", "readwrite", (s) => s.clear());
}

/* ---------- sozlamalar ---------- */

const DEFAULT_SETTINGS = {
  theme: "system", // system | light | dark
  model: "auto", // auto | fast | smart | code
  web: "auto", // auto | on | off
  imageQuality: "fast", // fast | hq
  imageAspect: "1:1",
  videoAspect: "16:9",
  videoSeconds: 20,
  accessCode: "",
};

export function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem("zumrad.settings") || "{}") };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem("zumrad.settings", JSON.stringify(s));
  } catch {
    /* maxfiy rejim — e'tiborsiz */
  }
}
