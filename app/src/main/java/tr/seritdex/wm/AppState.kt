package tr.seritdex.wm

import android.app.ActivityOptions
import android.content.Context
import android.content.Intent
import android.graphics.Point
import android.graphics.Rect
import android.hardware.display.DisplayManager
import android.view.Display
import kotlinx.coroutines.flow.MutableStateFlow

data class LiveWindow(
    val id: Int,
    val packageName: String,
    val title: String,
    val bounds: Rect,
    val focused: Boolean
)
data class LaunchableApp(val packageName: String, val label: String)

object AppState {
    val connected = MutableStateFlow(false)
    val windows = MutableStateFlow<List<LiveWindow>>(emptyList())
    val hudVisible = MutableStateFlow(true)
}
object WindowSizing {
    fun targetWidth(displayWidth: Int, ratio: Float): Int =
        (displayWidth.coerceAtLeast(1) * ratio.coerceIn(0.3333f, 1f)).toInt().coerceAtLeast(1)
}
object AppLauncher {
    fun installedApps(context: Context): List<LaunchableApp> {
        val query = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        return context.packageManager.queryIntentActivities(query, 0)
            .map { LaunchableApp(it.activityInfo.packageName, it.loadLabel(context.packageManager).toString()) }
            .filter { it.packageName != context.packageName }
            .distinctBy { it.packageName }
            .sortedBy { it.label.lowercase() }
    }

    // launchBounds is a DeX hint, not a way to force-resize already running tasks.
    fun open(context: Context, packageName: String, ratio: Float): String? {
        val launch = context.packageManager.getLaunchIntentForPackage(packageName)
            ?: return "Uygulama başlatıcısı bulunamadı."
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
        return try {
            val display = context.getSystemService(DisplayManager::class.java).getDisplay(Display.DEFAULT_DISPLAY)
            val point = Point()
            display?.getRealSize(point)
            val width = point.x.takeIf { it > 0 } ?: context.resources.displayMetrics.widthPixels
            val height = point.y.takeIf { it > 0 } ?: context.resources.displayMetrics.heightPixels
            val target = WindowSizing.targetWidth(width, ratio)
            val left = ((width - target) / 2).coerceAtLeast(0)
            val options = ActivityOptions.makeBasic()
            options.launchBounds = Rect(left, 0, left + target, height)
            context.startActivity(launch, options.toBundle())
            null
        } catch (e: Exception) {
            try { context.startActivity(launch); null }
            catch (fallback: Exception) {
                fallback.localizedMessage ?: "Android uygulama açılışını engelledi."
            }
        }
    }
}
