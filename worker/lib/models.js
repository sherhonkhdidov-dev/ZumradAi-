// Cloudflare Workers AI modellari va ularni tanlash mantiqi.
// Model ID'lar Cloudflare hujjatlaridan olingan; env o'zgaruvchilari orqali almashtirish mumkin.

export const DEFAULT_MODELS = {
  // Tez, ko'p tilli, rasmni ko'ra oladi, kvotani juda kam sarflaydi.
  fast: {
    id: "@cf/google/gemma-4-26b-a4b-it",
    label: "Gemma 4",
    tokenParam: "max_completion_tokens",
    vision: true,
  },
  // Murakkab fikrlash uchun kuchli (lekin kvotani ~7 baravar tez sarflaydi).
  smart: {
    id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    label: "Llama 3.3 70B",
    tokenParam: "max_tokens",
    vision: false,
  },
  // Dasturlash uchun ixtisoslashgan model.
  code: {
    id: "@cf/qwen/qwen2.5-coder-32b-instruct",
    label: "Qwen 2.5 Coder",
    tokenParam: "max_tokens",
    vision: false,
  },
  // Zaxira: yuqoridagilar ishlamasa.
  backup: {
    id: "@cf/meta/llama-3.1-8b-instruct-fp8",
    label: "Llama 3.1 8B",
    tokenParam: "max_tokens",
    vision: false,
  },
};

export const IMAGE_MODELS = {
  fast: { id: "@cf/black-forest-labs/flux-1-schnell", label: "FLUX.1 schnell" },
  hq: { id: "@cf/leonardo/lucid-origin", label: "Lucid Origin" },
};

export function resolveModels(env = {}) {
  const m = structuredClone(DEFAULT_MODELS);
  if (env.MODEL_FAST) m.fast.id = env.MODEL_FAST;
  if (env.MODEL_SMART) m.smart.id = env.MODEL_SMART;
  if (env.MODEL_CODE) m.code.id = env.MODEL_CODE;
  if (env.MODEL_BACKUP) m.backup.id = env.MODEL_BACKUP;
  return m;
}

const CODE_RE =
  /\b(kod|code|coding|dastur|program|funksiya|function|class|bug|debug|xato|error|exception|sayt|veb|website|web\s?sahifa|landing|html|css|javascript|typescript|python|react|vue|node|api|json|sql|bot|skript|script|algoritm|regex|git|github|docker|flutter|kotlin|java|php|laravel|django|flask|ilova|app)\b|```|=>|<\/?[a-z]+>|код|программ|скрипт|сайт|функци|ошибк|баг/i;

export function looksLikeCode(text) {
  return CODE_RE.test(String(text || ""));
}

/** "auto" | "fast" | "smart" | "code" -> model kaliti. */
export function pickModelKey(choice, { text = "", hasImages = false } = {}) {
  if (hasImages) return "fast"; // faqat fast modelda ko'rish qobiliyati bor
  if (choice === "fast" || choice === "smart" || choice === "code") return choice;
  return looksLikeCode(text) ? "code" : "fast";
}

/** Birinchisi ishlamasa, navbatdagi modellarga o'tish tartibi. */
export function fallbackChain(key, { hasImages = false } = {}) {
  if (hasImages) return ["fast"];
  const order = {
    fast: ["fast", "smart", "backup"],
    smart: ["smart", "fast", "backup"],
    code: ["code", "fast", "smart", "backup"],
  };
  return order[key] || order.fast;
}
