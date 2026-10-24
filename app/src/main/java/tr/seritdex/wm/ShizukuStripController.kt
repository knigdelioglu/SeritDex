package tr.seritdex.wm

import android.content.ComponentName
import android.content.Context
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.graphics.Point
import android.graphics.Rect
import android.hardware.display.DisplayManager
import android.os.IBinder
import android.view.Display
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import org.json.JSONObject
import rikka.shizuku.Shizuku

data class ManagedTask(val id: Int, val packageName: String, val title: String, val initialBounds: Rect)

/** Opt-in privileged backend. All operations are fail-closed. */
object ShizukuStripController {
    val status = MutableStateFlow("Shizuku köprüsü bağlı değil")
    val connected = MutableStateFlow(false)
    val tasks = MutableStateFlow<List<ManagedTask>>(emptyList())
    val focusedIndex = MutableStateFlow(0)
    val widthFraction = MutableStateFlow(0.5f)
    @OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO.limitedParallelism(1))
    private var remote: IWindowTaskService? = null
    private val originals = mutableMapOf<Int, Rect>()
    private var requested = false
    private var listenerRegistered = false
    private var appContext: Context? = null

    private val permissionListener = Shizuku.OnRequestPermissionResultListener { code, result ->
        if (code == 1806) {
            val ctx = appContext
            if (result == PackageManager.PERMISSION_GRANTED && ctx != null) bind(ctx)
            else status.value = "Shizuku izni verilmedi"
        }
    }
    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            remote = IWindowTaskService.Stub.asInterface(binder)
            connected.value = remote != null
            status.value = if (connected.value) "Görev köprüsü hazır" else "Köprü açılamadı"
            refresh()
        }
        override fun onServiceDisconnected(name: ComponentName?) {
            remote = null
            connected.value = false
            tasks.value = emptyList()
            status.value = "Shizuku hizmet bağlantısı kesildi"
            DexAccessibilityService.active?.updateHud()
        }
    }

    fun connect(context: Context) {
        appContext = context.applicationContext
        try {
            if (!listenerRegistered) {
                Shizuku.addRequestPermissionResultListener(permissionListener)
                listenerRegistered = true
            }
            if (!Shizuku.pingBinder()) {
                status.value = "Shizuku çalışmıyor. Uygulamayı başlatıp kablosuz hata ayıklamayı etkinleştirin."
                return
            }
            if (Shizuku.checkSelfPermission() != PackageManager.PERMISSION_GRANTED) {
                status.value = "Shizuku yetkisi bekleniyor"
                if (!Shizuku.shouldShowRequestPermissionRationale()) Shizuku.requestPermission(1806)
                return
            }
            bind(context.applicationContext)
        } catch (e: Throwable) {
            status.value = "Shizuku erişilemiyor: " + (e.message ?: "bağlantı yok")
        }
    }

    private fun bind(context: Context) {
        if (requested && remote != null) return
        try {
            val args = Shizuku.UserServiceArgs(
                ComponentName(context.packageName, WindowTaskUserService::class.java.name)
            ).daemon(false).processNameSuffix("strip").tag("seritdex-task-control").version(8)
            Shizuku.bindUserService(args, connection)
            requested = true
            status.value = "Sistem görev servisine bağlanılıyor"
        } catch (e: Throwable) {
            requested = false
            status.value = "Shizuku bağlantı hatası: " + (e.message ?: "bilinmiyor")
        }
    }

    fun refresh(reportStatus: Boolean = true) {
        val service = remote ?: return
        scope.launch {
            try {
                val json = JSONObject(service.listTasks())
                val error = json.optString("error")
                if (error.isNotBlank()) {
                    status.value = "Görev keşfi başarısız: " + error
                    return@launch
                }
                val array = json.getJSONArray("tasks")
                val result = (0 until array.length()).map { i ->
                    val obj = array.getJSONObject(i)
                    val id = obj.getInt("taskId")
                    val rect = Rect(obj.getInt("left"), obj.getInt("top"),
                        obj.getInt("right"), obj.getInt("bottom"))
                    ManagedTask(id, obj.getString("packageName"), obj.getString("title"), rect)
                }.distinctBy { it.id }
                val previous = tasks.value
                val selectedId = previous.getOrNull(focusedIndex.value)?.id
                val ordered = previous.mapNotNull { old -> result.find { it.id == old.id } } +
                    result.filter { candidate -> previous.none { it.id == candidate.id } }.reversed()
                result.forEach { if (!originals.containsKey(it.id) && !it.initialBounds.isEmpty) originals[it.id] = Rect(it.initialBounds) }
                tasks.value = ordered
                focusedIndex.value = ordered.indexOfFirst { it.id == selectedId }.coerceAtLeast(0)
                if (reportStatus) {
                    status.value = if (result.isEmpty()) "Yönetilebilir açık görev bulunamadı" else
                        result.size.toString() + " görev bulundu. Şeridi uygula ile pencere taşıma denenebilir."
                }
                DexAccessibilityService.active?.updateHud()
            } catch (e: Throwable) {
                status.value = "Sistem görevleri okunamadı: " + (e.message ?: "bilinmiyor")
            }
        }
    }

    fun step(direction: Int) {
        if (!connected.value || tasks.value.isEmpty()) return
        focusedIndex.value = (focusedIndex.value + direction + tasks.value.size) % tasks.value.size
        apply()
    }

    fun apply() {
        val service = remote ?: run { status.value = "Shizuku bağlanmadı"; return }
        val context = appContext ?: return
        val snapshot = tasks.value
        if (snapshot.isEmpty()) return
        val selected = focusedIndex.value.coerceIn(0, snapshot.lastIndex)
        scope.launch {
            try {
                val display = context.getSystemService(DisplayManager::class.java)
                    .getDisplay(Display.DEFAULT_DISPLAY)
                val size = Point().also { display?.getRealSize(it) }
                val viewportWidth = size.x.takeIf { it > 0 } ?: 1920
                val viewportHeight = size.y.takeIf { it > 0 } ?: 1200
                val placements = StripLayout.placements(
                    taskIds = snapshot.map { it.id },
                    viewportWidth = viewportWidth,
                    viewportHeight = viewportHeight,
                    focusedIndex = selected,
                    fraction = widthFraction.value
                )
                placements.forEach { item ->
                    val r = item.requestedBounds
                    service.resizeTask(item.taskId, r.left, r.top, r.right, r.bottom,
                            viewportWidth, viewportHeight)
                }
                placements.filter { !it.parked && it.taskId != snapshot[selected].id }
                    .forEach { service.focusTask(it.taskId) }
                val focused = service.focusTask(snapshot[selected].id)
                // Restoring a minimized DeX task can replace its saved bounds.
                // Apply and verify the final positions after bringing tasks forward.
                var applied = 0
                placements.forEach { item ->
                    val r = item.requestedBounds
                    if (service.resizeTask(item.taskId, r.left, r.top, r.right, r.bottom,
                            viewportWidth, viewportHeight)) applied++
                }
                status.value = if (applied == placements.size) {
                    "Şerit uygulandı. " + applied + " pencere yeniden konumlandırıldı."
                } else {
                    "DeX bazı konumları reddetti/sınırladı: " + applied +
                        "/" + placements.size + " görev. Oklarla tüm pencerelere geçebilirsiniz."
                }
                if (!focused) status.value += " Odak değişimi engellendi."
                DexAccessibilityService.active?.updateHud()
            } catch (e: Throwable) {
                status.value = "Şerit uygulanamadı: " + (e.message ?: "sistem kısıtı")
            }
        }
    }

    fun restore() {
        val service = remote ?: return
        val snapshots = tasks.value
        val saved = snapshots.associate { it.id to originals[it.id] }
        scope.launch {
            val display = appContext?.getSystemService(DisplayManager::class.java)
                ?.getDisplay(Display.DEFAULT_DISPLAY)
            val size = Point().also { display?.getRealSize(it) }
            var count = 0
            snapshots.forEach { task ->
                val rect = saved[task.id] ?: return@forEach
                if (!rect.isEmpty && service.resizeTask(task.id, rect.left, rect.top, rect.right, rect.bottom,
                        size.x.takeIf { it > 0 } ?: 1920, size.y.takeIf { it > 0 } ?: 1200)) count++
            }
            status.value = "Önceki konuma kurtarılan pencere: " + count + "/" + snapshots.size
        }
    }
}
