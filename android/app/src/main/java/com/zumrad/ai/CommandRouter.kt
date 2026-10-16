package com.zumrad.ai

import android.content.Context
import android.content.Intent
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale

/** Ovozli buyruqni tahlil qiladi: ilova ochish, qidirish, aks holda Zumrad AI bilan suhbat. */
object CommandRouter {

    private val OPEN = Regex("^(?:(.+?)\\s+(?:ni\\s+)?(?:och|ochib ber|ochgin|ochib bering|ishga tushir)|(?:och|ochib ber|ochgin)\\s+(.+))$")
    private val SEARCH = Regex("^(?:qidir|izla|google|gugl)\\w*\\s+(.+)$")
    private val ALIASES = mapOf(
        "yutub" to "youtube", "yutube" to "youtube", "ютуб" to "youtube",
        "telegram" to "telegram", "телеграм" to "telegram",
        "instagram" to "instagram", "инстаграм" to "instagram",
        "vatsap" to "whatsapp", "whatsapp" to "whatsapp",
        "kamera" to "camera", "sozlamalar" to "settings", "sozlama" to "settings",
        "xarita" to "maps", "karta" to "maps", "kalkulyator" to "calculator",
        "galereya" to "gallery", "rasmlar" to "photos", "soat" to "clock",
        "brauzer" to "chrome", "xrom" to "chrome", "krom" to "chrome",
    )

    fun handle(ctx: Context, raw: String, launch: (Intent) -> Unit): String {
        val text = raw.lowercase(Locale.ROOT).trim(' ', ',', '.', '!', '?')

        if (text in setOf("to'xta", "to‘xta", "toxta", "jim", "yetarli", "bo'ldi", "bo‘ldi", "rahmat")) {
            return "Xo'p."
        }
        if (text.contains("zumradni och") || text == "ilovani och" || text == "zumrad ai") {
            launch(Intent(ctx, MainActivity::class.java))
            return "Zumrad ochildi."
        }

        SEARCH.find(text)?.let {
            val q = it.groupValues[1]
            launch(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/search?q=" + Uri.encode(q))))
            return "$q bo'yicha qidiryapman."
        }

        OPEN.find(text)?.let { m ->
            val name = (m.groupValues[1].ifEmpty { m.groupValues[2] }).trim()
            val intent = findApp(ctx, name)
            return if (intent != null) {
                launch(intent)
                "$name ochilmoqda."
            } else {
                "$name ilovasini topa olmadim."
            }
        }

        return chat(ctx, raw)
    }

    private fun findApp(ctx: Context, spoken: String): Intent? {
        val pm = ctx.packageManager
        val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val apps = pm.queryIntentActivities(launcher, 0)
        val variants = linkedSetOf(spoken, spoken.removeSuffix("ni"), spoken.removeSuffix("ga"), spoken.removeSuffix("ni").removeSuffix("ning"))
        val wanted = variants.map { ALIASES[it] ?: it }.filter { it.isNotBlank() }
        for (w in wanted) {
            val hit = apps.firstOrNull { ri ->
                val label = ri.loadLabel(pm).toString().lowercase(Locale.ROOT)
                label == w || label.contains(w) || ri.activityInfo.packageName.lowercase(Locale.ROOT).contains(w)
            }
            if (hit != null) return pm.getLaunchIntentForPackage(hit.activityInfo.packageName)
        }
        return null
    }

    /** Zumrad AI Worker'iga so'rov: POST /api/chat {stream:false}. */
    private fun chat(ctx: Context, text: String): String {
        val base = ctx.getString(R.string.app_url).trimEnd('/')
        val code = ctx.getString(R.string.access_code)
        val body = JSONObject().put("stream", false).put(
            "messages", JSONArray().put(JSONObject().put("role", "user").put("content", text))
        )
        val conn = (URL("$base/api/chat").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            readTimeout = 60_000
            doOutput = true
            setRequestProperty("content-type", "application/json")
            if (code.isNotBlank()) setRequestProperty("x-access-code", code)
        }
        return try {
            conn.outputStream.use { it.write(body.toString().toByteArray()) }
            val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
            val resp = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            val json = runCatching { JSONObject(resp) }.getOrNull()
            val reply = json?.optString("reply").orEmpty()
            val error = json?.optString("error").orEmpty()
            when {
                reply.isNotBlank() -> speakable(reply)
                error.isNotBlank() -> speakable(error)
                else -> "Zumrad javob bermadi."
            }
        } catch (e: Exception) {
            "Serverga ulanib bo'lmadi."
        } finally {
            conn.disconnect()
        }
    }

    /** Ovozda o'qishga qulay qilish: markdown belgilarini olib tashlab, uzunligini cheklaydi. */
    private fun speakable(s: String): String =
        s.replace(Regex("```[\\s\\S]*?```"), " kod ")
            .replace(Regex("[*_`#>|]"), "")
            .replace(Regex("\\s+"), " ")
            .trim()
            .take(400)
}
