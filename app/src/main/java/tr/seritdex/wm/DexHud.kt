package tr.seritdex.wm

import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView

/** Accessibility overlay requires no SYSTEM_ALERT_WINDOW or foreground service. */
class DexHud(private val service: DexAccessibilityService) {
    private val wm = service.getSystemService(WindowManager::class.java)
    private var panel: LinearLayout? = null
    private fun dp(n: Int) = (n * service.resources.displayMetrics.density).toInt()

    private fun pill(label: String, tap: () -> Unit): TextView =
        TextView(service).apply {
            text = label
            setTextColor(Color.WHITE)
            textSize = 12f
            gravity = Gravity.CENTER
            setPadding(dp(12), dp(6), dp(12), dp(6))
            background = GradientDrawable().apply {
                setColor(Color.rgb(39, 52, 74))
                cornerRadius = dp(12).toFloat()
            }
            setOnClickListener { tap() }
        }

    fun show() {
        if (panel != null) return
        val view = LinearLayout(service).apply {
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(9), dp(8), dp(9), dp(8))
            background = GradientDrawable().apply {
                setColor(Color.rgb(16, 23, 37))
                cornerRadius = dp(18).toFloat()
            }
            elevation = dp(8).toFloat()
        }
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT, dp(52),
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        ).apply { gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL; y = dp(22) }
        runCatching { wm.addView(view, params); panel = view }
    }

    fun render(windows: List<LiveWindow>) {
        val parent = panel ?: return
        parent.removeAllViews()
        parent.addView(pill("ŞeritDeX") {
            service.packageManager.getLaunchIntentForPackage(service.packageName)?.let {
                it.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                runCatching { service.startActivity(it) }
            }
        })
        if (ShizukuStripController.connected.value && ShizukuStripController.tasks.value.isNotEmpty()) {
            val left = pill("◀") { ShizukuStripController.step(-1) }
            parent.addView(left, LinearLayout.LayoutParams(dp(38), dp(36)).apply { leftMargin = dp(5) })
            val right = pill("▶") { ShizukuStripController.step(1) }
            parent.addView(right, LinearLayout.LayoutParams(dp(38), dp(36)).apply { leftMargin = dp(5) })
            val label = ShizukuStripController.tasks.value.getOrNull(
                ShizukuStripController.focusedIndex.value
            )?.packageName?.substringAfterLast('.') ?: "Şerit"
            parent.addView(pill(label.take(16)) { ShizukuStripController.refresh() },
                LinearLayout.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT, dp(36)).apply {
                    leftMargin = dp(6)
                })
            return
        }
        windows.take(4).forEach { window ->
            val button = pill(window.title.take(14)) { AppLauncher.open(service, window.packageName, 0.5f) }
            val params = LinearLayout.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT, dp(36)
            ).apply { leftMargin = dp(6) }
            parent.addView(button, params)
        }
    }

    fun hide() {
        panel?.let { runCatching { wm.removeView(it) } }
        panel = null
    }
}
