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
    private val arrows = mutableListOf<TextView>()
    private var currentLabel: TextView? = null
    private var fallbackWindow: LiveWindow? = null
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
        view.addView(pill("ŞeritDeX") {
            service.packageManager.getLaunchIntentForPackage(service.packageName)?.let {
                it.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                runCatching { service.startActivity(it) }
            }
        })
        arrows.clear()
        listOf("◀" to -1, "▶" to 1).forEach { (label, direction) ->
            val arrow = pill(label) { service.navigate(direction) }.apply {
                contentDescription = if (direction < 0) "Önceki pencere" else "Sonraki pencere"
            }
            arrows.add(arrow)
            view.addView(arrow, LinearLayout.LayoutParams(dp(48), dp(48)).apply { leftMargin = dp(5) })
        }
        currentLabel = pill("Pencere yok") {
            if (ShizukuStripController.connected.value && ShizukuStripController.tasks.value.isNotEmpty()) {
                ShizukuStripController.refresh()
            } else {
                fallbackWindow?.let { AppLauncher.open(service, it.packageName, 0.5f) }
            }
        }.apply {
            maxLines = 1
            ellipsize = android.text.TextUtils.TruncateAt.END
        }
        view.addView(currentLabel, LinearLayout.LayoutParams(dp(136), dp(36)).apply { leftMargin = dp(6) })
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT, dp(64),
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        ).apply { gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL; y = dp(58) }
        runCatching { wm.addView(view, params); panel = view }
    }

    fun render(windows: List<LiveWindow>) {
        if (panel == null) return
        fallbackWindow = windows.firstOrNull { it.focused } ?: windows.firstOrNull()
        val canNavigate = windows.isNotEmpty() ||
            (ShizukuStripController.connected.value && ShizukuStripController.tasks.value.isNotEmpty())
        arrows.forEach {
            it.isEnabled = canNavigate
            it.alpha = if (canNavigate) 1f else 0.4f
        }
        if (ShizukuStripController.connected.value && ShizukuStripController.tasks.value.isNotEmpty()) {
            val label = ShizukuStripController.tasks.value.getOrNull(
                ShizukuStripController.focusedIndex.value
            )?.packageName?.substringAfterLast('.') ?: "Şerit"
            val position = "${ShizukuStripController.focusedIndex.value + 1}/${ShizukuStripController.tasks.value.size}"
            currentLabel?.text = "${label.take(12)} $position"
            return
        }
        currentLabel?.text = fallbackWindow?.title?.take(14) ?: "Pencere yok"
    }

    fun hide() {
        panel?.let { runCatching { wm.removeView(it) } }
        panel = null
        arrows.clear()
        currentLabel = null
        fallbackWindow = null
    }
}
