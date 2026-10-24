package tr.seritdex.wm

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.graphics.Rect
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityWindowInfo

class DexAccessibilityService : AccessibilityService() {
    private var hud: DexHud? = null
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
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType == AccessibilityEvent.TYPE_WINDOWS_CHANGED ||
            event?.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) refreshWindows()
    }

    private fun refreshWindows() {
        val entries = (windows ?: emptyList())
            .filter { it.type == AccessibilityWindowInfo.TYPE_APPLICATION }
            .sortedByDescending { it.layer }
            .mapNotNull { win ->
                val pkg = win.root?.packageName?.toString() ?: return@mapNotNull null
                if (pkg == packageName) return@mapNotNull null
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
        if (AppState.hudVisible.value) hud?.show() else hud?.hide()
        hud?.render(AppState.windows.value)
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
                val entries = AppState.windows.value
                if (entries.isEmpty()) return false
                val focused = entries.indexOfFirst { it.focused }.takeIf { it >= 0 } ?: 0
                val delta = if (event.keyCode == KeyEvent.KEYCODE_DPAD_LEFT ||
                    event.keyCode == KeyEvent.KEYCODE_LEFT_BRACKET) -1 else 1
                AppLauncher.open(this, entries[(focused + delta + entries.size) % entries.size].packageName, 0.5f)
                return true
            }
        }
        return false
    }

    override fun onInterrupt() = Unit

    override fun onDestroy() {
        hud?.hide()
        hud = null
        active = null
        AppState.connected.value = false
        AppState.windows.value = emptyList()
        super.onDestroy()
    }
}
