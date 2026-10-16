package com.zumrad.ai

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.core.content.ContextCompat

/** Zumrad sayti (WebView) + fon rejimida «Zumrad» deb chaqirishni yoqadigan xizmat. */
class MainActivity : Activity() {

    private lateinit var web: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        web = WebView(this)
        setContentView(web)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.mediaPlaybackRequiresUserGesture = false
        web.webViewClient = WebViewClient()
        web.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread { request.grant(request.resources) }
            }
        }
        web.loadUrl(getString(R.string.app_url))
        ensurePermissionsThenStartService()
    }

    private fun ensurePermissionsThenStartService() {
        val need = mutableListOf<String>()
        if (!granted(Manifest.permission.RECORD_AUDIO)) need += Manifest.permission.RECORD_AUDIO
        if (Build.VERSION.SDK_INT >= 33 && !granted(Manifest.permission.POST_NOTIFICATIONS)) {
            need += Manifest.permission.POST_NOTIFICATIONS
        }
        if (need.isEmpty()) onReady() else requestPermissions(need.toTypedArray(), 1)
    }

    private fun granted(p: String) = checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED

    override fun onRequestPermissionsResult(code: Int, perms: Array<out String>, results: IntArray) {
        super.onRequestPermissionsResult(code, perms, results)
        if (granted(Manifest.permission.RECORD_AUDIO)) {
            onReady()
        } else {
            Toast.makeText(this, "Mikrofonga ruxsat bermasangiz, «Zumrad» deb chaqirib bo‘lmaydi.", Toast.LENGTH_LONG).show()
        }
    }

    private fun onReady() {
        ContextCompat.startForegroundService(this, Intent(this, WakeService::class.java))
        // Fon rejimida boshqa ilovalarni ochish uchun «boshqa ilovalar ustida ko'rsatish» ruxsati kerak.
        val prefs = getSharedPreferences("zumrad", MODE_PRIVATE)
        if (!Settings.canDrawOverlays(this) && !prefs.getBoolean("overlay_asked", false)) {
            prefs.edit().putBoolean("overlay_asked", true).apply()
            Toast.makeText(
                this,
                "Zumrad boshqa ilovalarni ochishi uchun keyingi oynada ruxsatni yoqing.",
                Toast.LENGTH_LONG
            ).show()
            startActivity(
                Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
            )
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else super.onBackPressed()
    }
}
