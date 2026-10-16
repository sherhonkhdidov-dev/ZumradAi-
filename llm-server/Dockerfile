# Zumrad "miya" serveri: o'zingiz joylagan ochiq model (GGUF) + llama.cpp.
# Hugging Face Space (Docker) yoki istalgan Docker hostingda ishlaydi. Limit va to'lov yo'q.
FROM ghcr.io/ggml-org/llama.cpp:server

ENV LLAMA_CACHE=/tmp/llama-cache
EXPOSE 7860

# Modelni almashtirish uchun faqat shu qatordagi nomni o'zgartiring.
# LLAMA_API_KEY (Space → Settings → Secrets) berilsa, server faqat shu kalit bilan javob beradi.
CMD ["-hf", "Qwen/Qwen2.5-1.5B-Instruct-GGUF:Q4_K_M", "--host", "0.0.0.0", "--port", "7860", "-c", "4096", "--alias", "zumrad"]
