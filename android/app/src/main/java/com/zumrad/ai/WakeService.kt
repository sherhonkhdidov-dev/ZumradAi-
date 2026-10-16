package com.zumrad.ai

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import java.util.Locale

/**
 * Fon rejimida doim tinglaydi. «Zumrad» desangiz — "Eshitaman" deydi, buyruqni tinglaydi va
 * ovoz bilan javob beradi (ilovalarni ochish, qidirish yoki Zumrad AI bilan suhbat).
 */
class WakeService : Service(), RecognitionListener, TextToSpeech.OnInitListener {

    private enum class Mode { WAKE, COMMAND }

    private val main = Handler(Looper.getMainLooper())
    private var recognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var mode = Mode.WAKE
    private var busy = false          // gapirayapti yoki javob olayapti — tinglamaymiz
    private var running = false
    private var errorStreak = 0

    // ---------------------------------------------------------------- hayot sikli

    override fun onCreate() {
        super.onCreate()
        createChannel()
        ServiceCompat.startForeground(
            this, NOTIF_ID, ongoingNotification(),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
        )
        tts = TextToSpeech(this, this)
        running = true
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            running = false
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }
        running = true
        main.post { listen() }
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        running = false
        main.removeCallbacksAndMessages(null)
        recognizer?.destroy()
        recognizer = null
        tts?.shutdown()
        tts = null
        super.onDestroy()
    }

    // ---------------------------------------------------------------- TTS

    override fun onInit(status: Int) {
        val engine = tts ?: return
        if (status != TextToSpeech.SUCCESS) return
        val candidates = listOf(Locale("uz", "UZ"), Locale("tr", "TR"), Locale.getDefault())
        for (loc in candidates) {
            if (engine.setLanguage(loc) >= TextToSpeech.LANG_AVAILABLE) break
        }
        engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {}
            override fun onError(utteranceId: String?) { onSpoken(utteranceId) }
            override fun onDone(utteranceId: String?) { onSpoken(utteranceId) }
        })
        ttsReady = true
        if (recognizer == null) main.post { listen() }
    }

    private fun onSpoken(id: String?) {
        main.post {
            busy = false
            if (id == UTT_PROMPT) mode = Mode.COMMAND else mode = Mode.WAKE
            listen()
        }
    }

    private fun speak(text: String, id: String) {
        busy = true
        recognizer?.cancel()
        if (!ttsReady) { // TTS tayyor emas — jim davom etamiz
            main.post { onSpoken(id) }
            return
        }
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, id)
    }

    // ---------------------------------------------------------------- tinglash

    private fun listen(delayMs: Long = 0) {
        main.postDelayed({
            if (!running || busy) return@postDelayed
            if (!SpeechRecognizer.isRecognitionAvailable(this)) return@postDelayed
            val r = recognizer ?: SpeechRecognizer.createSpeechRecognizer(this).also {
                it.setRecognitionListener(this)
                recognizer = it
            }
            val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "uz-UZ")
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
                putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, packageName)
            }
            try { r.startListening(i) } catch (_: Exception) { resetRecognizer(); listen(1500) }
        }, delayMs)
    }

    private fun resetRecognizer() {
        recognizer?.destroy()
        recognizer = null
    }

    override fun onPartialResults(partial: Bundle?) {
        if (mode != Mode.WAKE || busy) return
        val list = partial?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) ?: return
        if (list.any { WAKE.containsMatchIn(it.lowercase()) }) wakeHeard(list)
    }

    override fun onResults(results: Bundle?) {
        if (busy) return
        errorStreak = 0
        val list = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION).orEmpty()
        if (list.isEmpty()) { listen(200); return }
        if (mode == Mode.WAKE) {
            if (list.any { WAKE.containsMatchIn(it.lowercase()) }) wakeHeard(list) else listen(150)
        } else {
            val text = list.first().trim()
            if (text.isEmpty()) { mode = Mode.WAKE; listen(200) } else handleCommand(text)
        }
    }

    /** «Zumrad» eshitildi. Shu gapning o'zida buyruq ham bo'lsa — darhol bajaramiz. */
    private fun wakeHeard(list: List<String>) {
        if (busy) return
        val full = list.first { WAKE.containsMatchIn(it.lowercase()) }
        val rest = WAKE.replaceFirst(full.lowercase(), "|").substringAfter("|").trim(' ', ',', '.', '!', '?')
        if (rest.length >= 3) {
            handleCommand(rest)
        } else {
            speak("Eshitaman", UTT_PROMPT)
        }
    }

    override fun onError(error: Int) {
        if (!running || busy) return
        when (error) {
            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> {
                running = false; stopSelf()
            }
            SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> {
                if (mode == Mode.COMMAND) mode = Mode.WAKE
                listen(150)
            }
            SpeechRecognizer.ERROR_RECOGNIZER_BUSY, SpeechRecognizer.ERROR_CLIENT -> {
                resetRecognizer(); listen(800)
            }
            else -> { // tarmoq / server xatolari: kutish vaqtini oshirib qayta urinamiz
                errorStreak++
                resetRecognizer()
                listen((1000L * errorStreak).coerceAtMost(10_000L))
            }
        }
    }

    override fun onReadyForSpeech(params: Bundle?) {}
    override fun onBeginningOfSpeech() {}
    override fun onRmsChanged(rmsdB: Float) {}
    override fun onBufferReceived(buffer: ByteArray?) {}
    override fun onEndOfSpeech() {}
    override fun onEvent(eventType: Int, params: Bundle?) {}

    // ---------------------------------------------------------------- buyruqlar

    private fun handleCommand(text: String) {
        busy = true
        recognizer?.cancel()
        mode = Mode.WAKE
        Thread {
            val reply = try {
                CommandRouter.handle(this, text) { intent -> launch(intent) }
            } catch (e: Exception) {
                "Xatolik yuz berdi."
            }
            main.post {
                busy = false
                speak(reply, UTT_REPLY)
            }
        }.start()
    }

    /** Fon rejimida ilova ochish: overlay ruxsati bo'lsa darhol, bo'lmasa bildirishnoma orqali. */
    private fun launch(intent: Intent) {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (Settings.canDrawOverlays(this)) {
            try { startActivity(intent); return } catch (_: Exception) { /* pastga */ }
        }
        val pi = PendingIntent.getActivity(
            this, 2, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val n = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("Zumrad")
            .setContentText("Ochish uchun bosing")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setFullScreenIntent(pi, true)
            .setContentIntent(pi)
            .setAutoCancel(true)
            .build()
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).notify(NOTIF_ID + 1, n)
    }

    // ---------------------------------------------------------------- bildirishnoma

    private fun createChannel() {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Zumrad", NotificationManager.IMPORTANCE_HIGH)
        )
    }

    private fun ongoingNotification(): Notification {
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val stop = PendingIntent.getService(
            this, 1, Intent(this, WakeService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle(getString(R.string.notif_title))
            .setContentText(getString(R.string.notif_text))
            .setContentIntent(open)
            .setOngoing(true)
            .addAction(0, getString(R.string.notif_stop), stop)
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "zumrad_wake"
        private const val NOTIF_ID = 1001
        private const val ACTION_STOP = "com.zumrad.ai.STOP"
        private const val UTT_PROMPT = "prompt"
        private const val UTT_REPLY = "reply"
        private val WAKE = Regex("(zumrad|zumrat|zumurrad|zumrud|zumrod|зумрад|зумрат|зумруд)")
    }
}
