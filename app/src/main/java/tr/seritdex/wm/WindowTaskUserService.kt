package tr.seritdex.wm

import android.annotation.SuppressLint
import android.app.ActivityManager
import android.app.ActivityOptions
import android.content.Intent
import android.graphics.Rect
import android.os.IBinder
import android.os.Bundle
import org.json.JSONArray
import org.json.JSONObject

/**
 * Runs in Shizuku's user-service process under the ADB-shell identity.
 * No hidden API calls are made from the ordinary app process.
 * This is an experimental Android 16 / One UI bridge: OEM policy may reject
 * or clamp requested positions. Every operation returns an explicit result.
 */
class WindowTaskUserService : IWindowTaskService.Stub() {
    private val intType = Int::class.javaPrimitiveType!!
    private val boolType = Boolean::class.javaPrimitiveType!!
    private var desktopRootId: Int? = null

    // The code runs as Shizuku's shell user service, not in the restricted app process.
    @SuppressLint("BlockedPrivateApi")
    private fun manager(): Any {
        val sm = Class.forName("android.os.ServiceManager")
        val binder = sm.getDeclaredMethod("getService", String::class.java)
            .invoke(null, "activity_task") as IBinder
        val stub = Class.forName("android.app.IActivityTaskManager\$Stub")
        return stub.getDeclaredMethod("asInterface", IBinder::class.java).invoke(null, binder)
            ?: error("IActivityTaskManager erişilemiyor")
    }

    private fun currentBounds(mgr: Any, taskId: Int): Rect? = runCatching {
        mgr.javaClass.getMethod("getTaskBounds", intType).invoke(mgr, taskId) as Rect?
    }.getOrNull()

    private fun currentTasks(mgr: Any): List<ActivityManager.RunningTaskInfo> =
        (mgr.javaClass.getMethod("getTasks", intType, boolType, boolType, intType)
            .invoke(mgr, 40, false, false, -1) as? List<*>)
            .orEmpty().filterIsInstance<ActivityManager.RunningTaskInfo>()

    private fun rememberDesktop(mgr: Any) {
        val root = mgr.javaClass.getMethod("getFocusedRootTaskInfo").invoke(mgr) ?: return
        val mode = root.javaClass.getMethod("getWindowingMode").invoke(root) as Int
        if (mode == 5 && root.javaClass.getField("displayId").getInt(root) == 0) {
            desktopRootId = root.javaClass.getField("taskId").getInt(root)
        }
    }

    override fun listTasks(): String = try {
        val mgr = manager()
        rememberDesktop(mgr)
        val array = JSONArray()
        currentTasks(mgr).forEach { item ->
            val pkg = item.topActivity?.packageName ?: item.baseActivity?.packageName
            val config = item.javaClass.getField("configuration").get(item)
            val windowConfig = config.javaClass.getField("windowConfiguration").get(config)
            val mode = windowConfig.javaClass.getMethod("getWindowingMode").invoke(windowConfig) as Int
            val displayId = item.javaClass.getField("displayId").getInt(item)
            if (mode != 5 || displayId != 0 || item.baseActivity?.packageName == "tr.seritdex.wm" ||
                pkg.isNullOrBlank() || pkg == "tr.seritdex.wm" ||
                pkg == "com.android.systemui" || pkg.contains("launcher", ignoreCase = true)
            ) return@forEach
            val rect = currentBounds(mgr, item.taskId) ?: Rect()
            array.put(JSONObject().apply {
                put("taskId", item.taskId)
                put("packageName", pkg)
                put("title", item.topActivity?.shortClassName ?: pkg.substringAfterLast('.'))
                put("left", rect.left)
                put("top", rect.top)
                put("right", rect.right)
                put("bottom", rect.bottom)
            })
        }
        JSONObject().put("tasks", array).toString()
    } catch (e: Throwable) {
        JSONObject().put("error", e.cause?.message ?: e.message ?: "Görev listesine erişilemedi").toString()
    }

    override fun resizeTask(taskId: Int, left: Int, top: Int, right: Int, bottom: Int,
                            viewportWidth: Int, viewportHeight: Int): Boolean {
        if (taskId <= 0 || right <= left || bottom <= top || viewportWidth <= 0 || viewportHeight <= 0) return false
        return try {
            val mgr = manager()
            val bounds = Rect(left, top, right, bottom)
            // RESIZE_MODE_USER_FORCED == 3 on Android 16.
            val method = mgr.javaClass.getMethod("resizeTask", intType, Rect::class.java, intType)
            val result = method.invoke(mgr, taskId, bounds, 3)
            if (result is Boolean && !result) return false
            var observed = currentBounds(mgr, taskId) ?: return false
            // One UI can enlarge a task to its minimum width after the request.
            // Reanchor that actual size so its title bar and content remain reachable.
            val safe = Rect(observed).apply {
                offsetTo(observed.left.coerceIn(0, (viewportWidth - width()).coerceAtLeast(0)),
                    observed.top.coerceIn(0, (viewportHeight - height()).coerceAtLeast(0)))
            }
            if (safe != observed) {
                method.invoke(mgr, taskId, safe, 3)
                observed = currentBounds(mgr, taskId) ?: return false
            }
            kotlin.math.abs(observed.left - left) <= 30 &&
                kotlin.math.abs(observed.top - top) <= 30 &&
                kotlin.math.abs(observed.width() - bounds.width()) <= 30 &&
                kotlin.math.abs(observed.height() - bounds.height()) <= 30 &&
                observed.left >= 0 && observed.top >= 0 &&
                observed.right <= viewportWidth && observed.bottom <= viewportHeight
        } catch (_: Throwable) {
            false
        }
    }

    override fun focusTask(taskId: Int): Boolean = try {
        val mgr = manager()
        rememberDesktop(mgr)
        val task = currentTasks(mgr).firstOrNull { it.taskId == taskId }
        val root = mgr.javaClass.getMethod("getFocusedRootTaskInfo").invoke(mgr)
        if (task != null) {
            val rootId = root?.let { it.javaClass.getField("taskId").getInt(it) }
            val parentId = task.javaClass.getField("parentTaskId").getInt(task)
            // Restore through the normal activity launch path so DeX handles
            // its minimized desktop and also works when navigation starts on Home.
            if (parentId != rootId) {
                val options = ActivityOptions.makeBasic()
                options.javaClass.getMethod("setLaunchTaskId", intType).invoke(options, taskId)
                val intent = Intent(task.baseIntent).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                }
                val userId = task.javaClass.getField("userId").getInt(task)
                val launched = runCatching {
                    val result = mgr.javaClass.getMethod("startActivityAsUser",
                        Class.forName("android.app.IApplicationThread"), String::class.java,
                        String::class.java, Intent::class.java, String::class.java, IBinder::class.java,
                        String::class.java, intType, intType, Class.forName("android.app.ProfilerInfo"),
                        Bundle::class.java, intType)
                        .invoke(mgr, null, "com.android.shell", null, intent, null, null, null,
                            0, 0, null, options.toBundle(), userId) as Int
                    result >= 0
                }.getOrDefault(false)
                if (!launched) {
                    // Internal activities may not be exported. Restore the existing
                    // task without trying to start that private activity.
                    val roots = mgr.javaClass.getMethod("getAllRootTaskInfos").invoke(mgr) as List<*>
                    val desktop = roots.filterNotNull().firstOrNull {
                        it.javaClass.getField("taskId").getInt(it) == desktopRootId
                    }
                    if (desktop != null) {
                        mgr.javaClass.getMethod("moveTaskToRootTask", intType, intType, boolType)
                            .invoke(mgr, taskId, desktopRootId, true)
                    } else {
                        mgr.javaClass.getMethod("startActivityFromRecents", intType, Bundle::class.java)
                            .invoke(mgr, taskId, options.toBundle())
                    }
                }
            }
        }
        // Focus alone does not raise a DeX window above the controller window.
        mgr.javaClass.getMethod("moveTaskToFront", Class.forName("android.app.IApplicationThread"),
            String::class.java, intType, intType, Bundle::class.java)
            .invoke(mgr, null, "com.android.shell", taskId, 0, null)
        mgr.javaClass.getMethod("setFocusedTask", intType).invoke(mgr, taskId)
        (0..3).any { attempt ->
            if (attempt > 0) android.os.SystemClock.sleep(40)
            currentTasks(mgr).firstOrNull { it.taskId == taskId }?.let {
                it.javaClass.getField("isFocused").getBoolean(it)
            } == true
        }
    } catch (error: Throwable) {
        android.util.Log.w("SeritDex", "Task focus failed for $taskId", error)
        false
    }

    override fun destroy() {
        // Shizuku calls this when replacing/unbinding the user service.
        kotlin.system.exitProcess(0)
    }
}
