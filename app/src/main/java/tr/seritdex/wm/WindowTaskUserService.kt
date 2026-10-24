package tr.seritdex.wm

import android.app.ActivityManager
import android.graphics.Rect
import android.os.IBinder
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

    override fun listTasks(): String = try {
        val mgr = manager()
        val method = mgr.javaClass.getMethod(
            "getTasks", intType, boolType, boolType, intType
        )
        val tasks = method.invoke(mgr, 40, false, false, -1) as? List<*> ?: emptyList<Any>()
        val array = JSONArray()
        tasks.filterIsInstance<ActivityManager.RunningTaskInfo>().forEach { item ->
            val pkg = item.topActivity?.packageName ?: item.baseActivity?.packageName
            if (pkg.isNullOrBlank() || pkg == "tr.seritdex.wm" ||
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

    override fun resizeTask(taskId: Int, left: Int, top: Int, right: Int, bottom: Int): Boolean {
        if (taskId <= 0 || right <= left || bottom <= top) return false
        return try {
            val mgr = manager()
            val bounds = Rect(left, top, right, bottom)
            // RESIZE_MODE_USER_FORCED == 3 on Android 16.
            val result = mgr.javaClass.getMethod("resizeTask", intType, Rect::class.java, intType)
                .invoke(mgr, taskId, bounds, 3)
            if (result is Boolean && !result) return false
            val observed = currentBounds(mgr, taskId) ?: return false
            kotlin.math.abs(observed.left - left) <= 30 &&
                kotlin.math.abs(observed.top - top) <= 30 &&
                kotlin.math.abs(observed.width() - bounds.width()) <= 30
        } catch (_: Throwable) {
            false
        }
    }

    override fun focusTask(taskId: Int): Boolean = try {
        val mgr = manager()
        mgr.javaClass.getMethod("setFocusedTask", intType).invoke(mgr, taskId)
        true
    } catch (_: Throwable) {
        false
    }

    override fun destroy() {
        // Shizuku user-service process lifecycle is owned by Shizuku.
    }
}
