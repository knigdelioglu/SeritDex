package tr.seritdex.wm

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.graphics.Rect
import android.os.Handler
import android.os.Looper
import android.content.pm.PackageManager
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityWindowInfo
import rikka.shizuku.Shizuku

class DexAccessibilityService : AccessibilityService() {
    private var hud: DexHud? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private val refreshTasks = Runnable {
        if (ShizukuStripController.connected.value) ShizukuStripController.refresh(reportStatus = false)
    }
    private val binderListener = Shizuku.OnBinderReceivedListener {
        // Reconnect only to an already authorized bridge; never request a new permission here.
        runCatching {
            if (Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED) {
                ShizukuStripController.connect(this)
            }
        }
    }
    companion object {
        var active: DexAccessibilityService? = null
            private set
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        active = this
        serviceInfo = serviceInfo.apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOWS_CHANGED or AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = flags or AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS or
                AccessibilityServiceInfo.FLAG_REQUEST_FILTER_KEY_EVENTS
            notificationTimeout = 100
        }
        AppState.connected.value = true
        hud = DexHud(this)
        refreshWindows()
        updateHud()
        Shizuku.addBinderReceivedListenerSticky(binderListener)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType == AccessibilityEvent.TYPE_WINDOWS_CHANGED ||
            event?.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            refreshWindows()
            mainHandler.removeCallbacks(refreshTasks)
            mainHandler.postDelayed(refreshTasks, 350)
        }
    }

    private fun refreshWindows() {
        val entries = (windows ?: emptyList())
            .filter { it.type == AccessibilityWindowInfo.TYPE_APPLICATION }
            .sortedByDescending { it.layer }
            .mapNotNull { win ->
                val pkg = win.root?.packageName?.toString() ?: return@mapNotNull null
                if (pkg == packageName || pkg == "com.android.systemui" ||
                    pkg.contains("launcher", ignoreCase = true)) return@mapNotNull null
                val bounds = Rect()
                win.getBoundsInScreen(bounds)
                LiveWindow(
                    id = win.id,
                    packageName = pkg,
                    title = win.title?.toString()?.takeIf { it.isNotBlank() } ?: pkg.substringAfterLast('.'),
                    bounds = bounds, focused = win.isFocused
                )
            }.distinctBy { it.id }
        AppState.windows.value = entries
        hud?.render(entries)
    }

    fun updateHud() {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            mainHandler.post { updateHud() }
            return
        }
        if (AppState.hudVisible.value) hud?.show() else hud?.hide()
        hud?.render(AppState.windows.value)
    }

    fun navigate(direction: Int) {
        if (ShizukuStripController.connected.value && ShizukuStripController.tasks.value.isNotEmpty()) {
            ShizukuStripController.step(direction)
            return
        }
        val entries = AppState.windows.value.sortedBy { it.id }
        if (entries.isEmpty()) return
        val focused = entries.indexOfFirst { it.focused }.takeIf { it >= 0 } ?: 0
        val next = (focused + direction + entries.size) % entries.size
        AppLauncher.open(this, entries[next].packageName, 0.5f)
    }

    override fun onKeyEvent(event: KeyEvent): Boolean {
        if (event.action != KeyEvent.ACTION_DOWN || !event.isAltPressed) return false
        when (event.keyCode) {
            KeyEvent.KEYCODE_SPACE -> {
                AppState.hudVisible.value = !AppState.hudVisible.value
                updateHud()
                return true
            }
            KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_LEFT_BRACKET,
            KeyEvent.KEYCODE_DPAD_RIGHT, KeyEvent.KEYCODE_RIGHT_BRACKET -> {
                val delta = if (event.keyCode == KeyEvent.KEYCODE_DPAD_LEFT ||
                    event.keyCode == KeyEvent.KEYCODE_LEFT_BRACKET) -1 else 1
                navigate(delta)
                return true
            }
        }
        return false
    }

    override fun onInterrupt() = Unit

    override fun onDestroy() {
        Shizuku.removeBinderReceivedListener(binderListener)
        mainHandler.removeCallbacksAndMessages(null)
        hud?.hide()
        hud = null
        active = null
        AppState.connected.value = false
        AppState.windows.value = emptyList()
        super.onDestroy()
    }
}
