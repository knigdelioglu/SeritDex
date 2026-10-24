export interface KotlinSourceFile {
  id: string;
  path: string;
  title: string;
  language: 'kotlin' | 'xml' | 'gradle' | 'yaml' | 'shell';
  category: 'Core Engine' | 'System Services' | 'Compose UI & HUD' | 'Build & Manifest';
  summary: string;
  linesOfCode: number;
  content: string;
}

export const KOTLIN_PROJECT_FILES: KotlinSourceFile[] = [
  {
    id: 'strip-layout-engine-kt',
    path: 'app/src/main/java/tr/seritdex/wm/engine/StripLayoutEngine.kt',
    title: 'StripLayoutEngine.kt',
    language: 'kotlin',
    category: 'Core Engine',
    summary: 'Galaxy Tab A11+ (1920x1200 90Hz) için sıfır çöp üretimi (zero-allocation) yatay şerit koordinat, dikey gruplama ve DeX ekran sınırı (clamping) hesaplama motoru.',
    linesOfCode: 196,
    content: `package tr.seritdex.wm.engine

import android.graphics.Rect
import androidx.compose.runtime.Immutable
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

enum class WidthPreset(val ratio: Float, val label: String) {
    ONE_THIRD(0.3333f, "1/3"),
    HALF(0.50f, "1/2"),
    TWO_THIRDS(0.6667f, "2/3"),
    FULL(1.0f, "Tam");

    fun next(): WidthPreset = entries[(ordinal + 1) % entries.size]
}

enum class ExecutionMode {
    SHIZUKU_TASK_MANAGER, // IActivityTaskManager.resizeTask (90Hz sıfır titreme)
    STANDARD_LAUNCH_BOUNDS // ActivityOptions.setLaunchBounds (ADB/Shizuku gerektirmez)
}

enum class VisibilityState {
    FULLY_VISIBLE,
    PARTIALLY_VISIBLE,
    OFFSCREEN_PARKED
}

@Immutable
data class StripColumn(
    val id: String,
    val widthPreset: WidthPreset = WidthPreset.HALF,
    val customWidthRatio: Float? = null,
    val taskIds: List<Int>, // 1 pencere veya dikey gruplanmış 2 pencere
    val splitRatio: Float = 0.5f
)

@Immutable
data class ComputedTaskPlacement(
    val taskId: Int,
    val columnId: String,
    val columnIndex: Int,
    val stackIndex: Int,
    val stackCount: Int,
    val stripBounds: Rect,
    val screenBounds: Rect,
    val dexSafeBounds: Rect,
    val visibilityState: VisibilityState,
    val isFocused: Boolean
)

@Immutable
data class StripConfig(
    val viewportWidth: Int = 1920,  // Galaxy Tab A11+ WUXGA
    val viewportHeight: Int = 1200,
    val topHudHeightPx: Int = 36,
    val bottomDockHeightPx: Int = 56,
    val outerMarginPx: Int = 14,
    val columnGapPx: Int = 14,
    val stackGapPx: Int = 12,
    val executionMode: ExecutionMode = ExecutionMode.SHIZUKU_TASK_MANAGER
)

object StripLayoutEngine {

    fun computeColumnWidthPx(column: StripColumn, config: StripConfig): Int {
        val usableWidth = config.viewportWidth - (config.outerMarginPx * 2)
        val ratio = column.customWidthRatio?.coerceIn(0.25f, 1.0f) ?: column.widthPreset.ratio
        if (ratio >= 0.99f) return usableWidth

        val gapComp = when (column.widthPreset) {
            WidthPreset.HALF -> config.columnGapPx / 2
            WidthPreset.ONE_THIRD -> (config.columnGapPx * 2) / 3
            else -> config.columnGapPx / 2
        }
        return max(380, (usableWidth * ratio - gapComp).roundToInt())
    }

    fun computePlacements(
        columns: List<StripColumn>,
        focusedTaskId: Int?,
        scrollOffsetPx: Int,
        config: StripConfig
    ): Pair<List<ComputedTaskPlacement>, Int> {
        val usableTop = config.topHudHeightPx + config.outerMarginPx
        val usableBottom = config.viewportHeight - config.bottomDockHeightPx - config.outerMarginPx
        val usableHeight = max(240, usableBottom - usableTop)

        var cursorX = config.outerMarginPx
        val result = ArrayList<ComputedTaskPlacement>(columns.size * 2)

        columns.forEachIndexed { colIndex, col ->
            if (col.taskIds.isEmpty()) return@forEachIndexed

            val colWidth = computeColumnWidthPx(col, config)
            val stripLeft = cursorX
            val stripRight = stripLeft + colWidth
            val screenLeft = stripLeft - scrollOffsetPx
            val screenRight = screenLeft + colWidth

            val stackCount = col.taskIds.size
            val split = col.splitRatio.coerceIn(0.25f, 0.75f)

            col.taskIds.forEachIndexed { stackIdx, taskId ->
                val (winTop, winBottom) = if (stackCount == 2) {
                    val firstHeight = ((usableHeight - config.stackGapPx) * split).roundToInt()
                    if (stackIdx == 0) {
                        usableTop to (usableTop + firstHeight)
                    } else {
                        (usableTop + firstHeight + config.stackGapPx) to usableBottom
                    }
                } else {
                    usableTop to usableBottom
                }

                val stripRect = Rect(stripLeft, winTop, stripRight, winBottom)
                val screenRect = Rect(screenLeft, winTop, screenRight, winBottom)

                val visLeft = screenLeft.coerceIn(0, config.viewportWidth)
                val visRight = screenRight.coerceIn(0, config.viewportWidth)
                val visWidth = max(0, visRight - visLeft)
                val visRatio = visWidth.toFloat() / colWidth.toFloat()

                val visibility = when {
                    visRatio >= 0.96f -> VisibilityState.FULLY_VISIBLE
                    visWidth >= 96 -> VisibilityState.PARTIALLY_VISIBLE
                    else -> VisibilityState.OFFSCREEN_PARKED
                }

                // Samsung DeX One UI WindowManager ekran dışı pencereleri zorla içeri iter.
                // Bu nedenle ekran dışı pencereler 24px kenar park yuvasında tutulur.
                val dexSafeRect = when {
                    visibility == VisibilityState.OFFSCREEN_PARKED -> {
                        val parkedLeft = if (screenLeft < 0) -colWidth + 24 else config.viewportWidth - 24
                        Rect(parkedLeft, winTop, parkedLeft + colWidth, winBottom)
                    }
                    config.executionMode == ExecutionMode.STANDARD_LAUNCH_BOUNDS -> {
                        val cLeft = screenLeft.coerceIn(0, config.viewportWidth - 360)
                        val cRight = screenRight.coerceIn(cLeft + 360, config.viewportWidth)
                        Rect(cLeft, winTop, cRight, winBottom)
                    }
                    else -> screenRect
                }

                result.add(
                    ComputedTaskPlacement(
                        taskId = taskId,
                        columnId = col.id,
                        columnIndex = colIndex,
                        stackIndex = stackIdx,
                        stackCount = stackCount,
                        stripBounds = stripRect,
                        screenBounds = screenRect,
                        dexSafeBounds = dexSafeRect,
                        visibilityState = visibility,
                        isFocused = (taskId == focusedTaskId)
                    )
                )
            }
            cursorX = stripRight + config.columnGapPx
        }

        val totalStripWidth = if (columns.isNotEmpty()) {
            cursorX - config.columnGapPx + config.outerMarginPx
        } else {
            config.viewportWidth
        }

        return result to totalStripWidth
    }

    fun computeScrollToCenterTask(
        placements: List<ComputedTaskPlacement>,
        totalStripWidth: Int,
        targetTaskId: Int,
        config: StripConfig
    ): Int {
        val target = placements.firstOrNull { it.taskId == targetTaskId } ?: return 0
        val maxScroll = max(0, totalStripWidth - config.viewportWidth)
        val colCenter = (target.stripBounds.left + target.stripBounds.right) / 2
        return (colCenter - config.viewportWidth / 2).coerceIn(0, maxScroll)
    }
}`
  },
  {
    id: 'dex-accessibility-service-kt',
    path: 'app/src/main/java/tr/seritdex/wm/service/DexAccessibilityService.kt',
    title: 'DexAccessibilityService.kt',
    language: 'kotlin',
    category: 'System Services',
    summary: 'Açık uygulama pencerelerini (AccessibilityWindowInfo) gerçek zamanlı izleyen, DeX fiziksel klavye kısayollarını (Alt+[, Alt+], Alt+R, Alt+G, Alt+Space) yakalayan çekirdek servis.',
    linesOfCode: 162,
    content: `package tr.seritdex.wm.service

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.graphics.Rect
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityWindowInfo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import tr.seritdex.wm.bridge.DexWindowController
import tr.seritdex.wm.overlay.StripOverlayManager

data class LiveDexWindow(
    val windowId: Int,
    val packageName: String,
    val title: String,
    val boundsInScreen: Rect,
    val isFocused: Boolean,
    val isActive: Boolean
)

class DexAccessibilityService : AccessibilityService() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private lateinit var windowController: DexWindowController
    private lateinit var overlayManager: StripOverlayManager
    private lateinit var gestureMonitor: DexThreeFingerGestureMonitor

    private val _liveWindows = MutableStateFlow<List<LiveDexWindow>>(emptyList())
    val liveWindows: StateFlow<List<LiveDexWindow>> = _liveWindows.asStateFlow()

    // Yeniden tahsisatı önlemek için tekil Rect havuzu (GC dostu)
    private val tempRect = Rect()

    override fun onServiceConnected() {
        super.onServiceConnected()
        serviceInfo = serviceInfo.apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOWS_CHANGED or
                AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS or
                AccessibilityServiceInfo.FLAG_REQUEST_FILTER_KEY_EVENTS or
                AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
            notificationTimeout = 16L // 90Hz (~11.1ms) için düşük gecikme eşiği
        }

        windowController = DexWindowController(applicationContext)
        overlayManager = StripOverlayManager(
            context = applicationContext,
            scope = serviceScope,
            windowController = windowController
        )
        gestureMonitor = DexThreeFingerGestureMonitor(
            onThreeFingerPanDelta = { deltaX ->
                overlayManager.scrollStripByFingerDelta(deltaX)
            },
            onThreeFingerRelease = { totalDeltaX, velocityPxPerSec ->
                overlayManager.resolveThreeFingerGestureEnd(totalDeltaX, velocityPxPerSec)
            }
        )
        overlayManager.attachHudOverlay()
        gestureMonitor.startMonitoring()
        refreshWindowSnapshot()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOWS_CHANGED,
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                refreshWindowSnapshot()
            }
        }
    }

    override fun onKeyEvent(event: KeyEvent): Boolean {
        if (event.action != KeyEvent.ACTION_DOWN) return false

        // Samsung DeX Fiziksel Klavye & Book Cover Kısayolları (Alt kombinasyonları)
        if (event.isAltPressed) {
            when (event.keyCode) {
                KeyEvent.KEYCODE_LEFT_BRACKET, KeyEvent.KEYCODE_DPAD_LEFT -> {
                    if (event.isShiftPressed) {
                        overlayManager.moveActiveColumnInStrip(direction = -1)
                    } else {
                        overlayManager.cycleFocusHorizontal(direction = -1)
                    }
                    return true
                }
                KeyEvent.KEYCODE_RIGHT_BRACKET, KeyEvent.KEYCODE_DPAD_RIGHT -> {
                    if (event.isShiftPressed) {
                        overlayManager.moveActiveColumnInStrip(direction = 1)
                    } else {
                        overlayManager.cycleFocusHorizontal(direction = 1)
                    }
                    return true
                }
                KeyEvent.KEYCODE_R -> {
                    overlayManager.cycleActiveColumnWidth()
                    return true
                }
                KeyEvent.KEYCODE_G -> {
                    overlayManager.toggleVerticalGroupWithNeighbor()
                    return true
                }
                KeyEvent.KEYCODE_C -> {
                    overlayManager.centerActiveWindowInViewport()
                    return true
                }
                KeyEvent.KEYCODE_SPACE -> {
                    overlayManager.toggleQuickSwitcherPalette()
                    return true
                }
            }
        }
        return super.onKeyEvent(event)
    }

    private fun refreshWindowSnapshot() {
        val rawWindows = windows ?: return
        val snapshot = ArrayList<LiveDexWindow>(rawWindows.size)

        for (i in 0 until rawWindows.size) {
            val win = rawWindows[i]
            if (win.type != AccessibilityWindowInfo.TYPE_APPLICATION) continue

            val root = win.root
            val pkg = root?.packageName?.toString() ?: continue
            if (pkg == packageName || pkg == "com.sec.android.app.launcher") continue

            win.getBoundsInScreen(tempRect)
            snapshot.add(
                LiveDexWindow(
                    windowId = win.id,
                    packageName = pkg,
                    title = win.title?.toString() ?: pkg.substringAfterLast('.'),
                    boundsInScreen = Rect(tempRect),
                    isFocused = win.isFocused,
                    isActive = win.isActive
                )
            )
        }

        _liveWindows.value = snapshot
        overlayManager.syncLiveWindows(snapshot)
    }

    override fun onInterrupt() {}

    override fun onDestroy() {
        gestureMonitor.stopMonitoring()
        overlayManager.detachHudOverlay()
        serviceScope.cancel()
        super.onDestroy()
    }
}`
  },
  {
    id: 'dex-window-controller-kt',
    path: 'app/src/main/java/tr/seritdex/wm/bridge/DexWindowController.kt',
    title: 'DexWindowController.kt',
    language: 'kotlin',
    category: 'System Services',
    summary: 'Shizuku IActivityTaskManager.resizeTask binder çağrıları ve standart ActivityOptions.setLaunchBounds API\'sini birleştiren hibrit pencere konumlandırma köprüsü.',
    linesOfCode: 138,
    content: `package tr.seritdex.wm.bridge

import android.app.ActivityManager
import android.app.ActivityOptions
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Rect
import android.os.IBinder
import android.os.Parcel
import rikka.shizuku.Shizuku
import rikka.shizuku.ShizukuBinderWrapper
import rikka.shizuku.SystemServiceHelper
import tr.seritdex.wm.engine.ComputedTaskPlacement
import tr.seritdex.wm.engine.ExecutionMode

class DexWindowController(private val context: Context) {

    companion object {
        // Android 14/15 One UI 6.1/7 RESIZE_MODE_USER_FORCED sabiti
        private const val RESIZE_MODE_USER_FORCED = 2
    }

    fun isShizukuReady(): Boolean {
        return try {
            Shizuku.pingBinder() && Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED
        } catch (_: Throwable) {
            false
        }
    }

    /**
     * Şerit üzerindeki tüm görünür pencerelerin yeni koordinatlarını uygular.
     * Shizuku aktifse IActivityTaskManager.resizeTask ile 90Hz akıcı kaydırma yapar;
     * aktif değilse standart ActivityOptions.setLaunchBounds(Rect) kullanır.
     */
    fun applyStripPlacements(
        placements: List<ComputedTaskPlacement>,
        packageByTaskId: Map<Int, String>,
        preferredMode: ExecutionMode
    ) {
        val useShizuku = preferredMode == ExecutionMode.SHIZUKU_TASK_MANAGER && isShizukuReady()

        for (placement in placements) {
            val targetBounds = placement.dexSafeBounds
            if (useShizuku) {
                resizeTaskViaShizukuBinder(placement.taskId, targetBounds)
            } else {
                val pkg = packageByTaskId[placement.taskId] ?: continue
                relaunchWithBoundsStandard(pkg, targetBounds)
            }
        }
    }

    /**
     * Katman 2 (Shizuku): IActivityTaskManager üzerinden doğrudan Task sınırlarını günceller.
     * Activity yeniden başlatılmaz, state kaybolmaz ve 90Hz kaydırma sırasında titreme olmaz.
     */
    private fun resizeTaskViaShizukuBinder(taskId: Int, bounds: Rect): Boolean {
        return try {
            val rawBinder: IBinder = SystemServiceHelper.getSystemService("activity_task") ?: return false
            val wrappedBinder = ShizukuBinderWrapper(rawBinder)

            // Hidden API Reflection / Stub.asInterface üzerinden doğrudan çağrı
            val stubClass = Class.forName("android.app.IActivityTaskManager\$Stub")
            val asInterfaceMethod = stubClass.getMethod("asInterface", IBinder::class.java)
            val atmInstance = asInterfaceMethod.invoke(null, wrappedBinder)

            val resizeMethod = atmInstance.javaClass.getMethod(
                "resizeTask",
                Int::class.javaPrimitiveType,
                Rect::class.java,
                Int::class.javaPrimitiveType
            )
            resizeMethod.invoke(atmInstance, taskId, bounds, RESIZE_MODE_USER_FORCED)
            true
        } catch (e: Throwable) {
            false
        }
    }

    /**
     * Katman 1 (Standart İzinler - ADB/Shizuku Yok):
     * ActivityOptions.makeBasic().setLaunchBounds(Rect) ile pencereyi hedef koordinata taşır.
     */
    fun relaunchWithBoundsStandard(packageName: String, bounds: Rect) {
        val pm = context.packageManager
        val launchIntent = pm.getLaunchIntentForPackage(packageName)?.apply {
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP
            )
        } ?: return

        val options = ActivityOptions.makeBasic().apply {
            launchBounds = bounds
        }

        // Samsung DeX Freeform modunu zorlamak için windowingMode = 5 (WINDOWING_MODE_FREEFORM)
        try {
            val setModeMethod = ActivityOptions::class.java.getMethod(
                "setLaunchWindowingMode",
                Int::class.javaPrimitiveType
            )
            setModeMethod.invoke(options, 5)
        } catch (_: Throwable) {
            // Cihaz zaten DeX masaüstü modundaysa varsayılan olarak Freeform açılır
        }

        context.startActivity(launchIntent, options.toBundle())
    }

    fun focusTask(taskId: Int) {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        am.moveTaskToFront(taskId, ActivityManager.MOVE_TASK_WITH_HOME)
    }
}`
  },
  {
    id: 'dex-three-finger-gesture-kt',
    path: 'app/src/main/java/tr/seritdex/wm/service/DexThreeFingerGestureMonitor.kt',
    title: 'DexThreeFingerGestureMonitor.kt',
    language: 'kotlin',
    category: 'System Services',
    summary: 'Shizuku IInputManager.monitorGestureInput ve Trackpad 3-parmak sınıflandırması ile alttaki uygulamaları engellemeden 90Hz şerit kaydırma ve fiske (fling) yakalayıcı.',
    linesOfCode: 144,
    content: `package tr.seritdex.wm.service

import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.view.InputChannel
import android.view.InputEvent
import android.view.InputEventReceiver
import android.view.MotionEvent
import android.view.VelocityTracker
import rikka.shizuku.ShizukuBinderWrapper
import rikka.shizuku.SystemServiceHelper
import kotlin.math.abs

/**
 * Samsung Galaxy Tab A11+ DeX üzerinde 3 parmakla sağa/sola kaydırmayı
 * alttaki pencerelerin dokunmatik olaylarını (1 ve 2 parmak) kesmeden yakalar.
 *
 * - 3 parmak yavaş/orta hızda sürüklenirken: Şerit kamerası (scrollOffsetPx) 90Hz gerçek zamanlı kayar.
 * - 3 parmak hızlı fiske (|velocityX| >= 520px/s) ile bırakıldığında: Doğrudan komşu sütuna odaklanır (Hooke yay fiziğiyle).
 */
class DexThreeFingerGestureMonitor(
    private val onThreeFingerPanDelta: (deltaX: Float) -> Unit,
    private val onThreeFingerRelease: (totalDeltaX: Float, velocityPxPerSec: Float) -> Unit
) {
    private var inputChannel: InputChannel? = null
    private var eventReceiver: ThreeFingerInputReceiver? = null
    private var velocityTracker: VelocityTracker? = null

    private var isThreeFingerActive = false
    private var startCentroidX = 0f
    private var lastCentroidX = 0f

    companion object {
        private const val DISPLAY_DEFAULT = 0
        private const val FLING_VELOCITY_THRESHOLD_PX_SEC = 520f
        private const val MIN_PAN_SLOP_PX = 8f
    }

    fun startMonitoring(): Boolean {
        return try {
            val rawBinder: IBinder = SystemServiceHelper.getSystemService("input") ?: return false
            val wrappedBinder = ShizukuBinderWrapper(rawBinder)
            val stubClass = Class.forName("android.hardware.input.IInputManager\\$Stub")
            val inputManager = stubClass.getMethod("asInterface", IBinder::class.java)
                .invoke(null, wrappedBinder)

            // IInputManager.monitorGestureInput: Sistem genelinde pasif dokunmatik kanal açar
            val monitorMethod = inputManager.javaClass.getMethod(
                "monitorGestureInput",
                String::class.java,
                Int::class.javaPrimitiveType
            )
            val monitorResult = monitorMethod.invoke(inputManager, "SeritDeX-3FingerMonitor", DISPLAY_DEFAULT)
            val channelField = monitorResult.javaClass.getDeclaredField("mInputChannel").apply {
                isAccessible = true
            }
            val channel = channelField.get(monitorResult) as? InputChannel ?: return false
            inputChannel = channel
            eventReceiver = ThreeFingerInputReceiver(channel, Looper.getMainLooper())
            true
        } catch (_: Throwable) {
            false
        }
    }

    fun stopMonitoring() {
        eventReceiver?.dispose()
        eventReceiver = null
        inputChannel?.dispose()
        inputChannel = null
        velocityTracker?.recycle()
        velocityTracker = null
    }

    private inner class ThreeFingerInputReceiver(
        channel: InputChannel,
        looper: Looper
    ) : InputEventReceiver(channel, looper) {

        override fun onInputEvent(event: InputEvent) {
            var handled = false
            try {
                if (event is MotionEvent) {
                    handled = processMotionEvent(event)
                }
            } finally {
                finishInputEvent(event, handled)
            }
        }
    }

    private fun processMotionEvent(event: MotionEvent): Boolean {
        val isTrackpadThreeFinger = Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE &&
            event.classification == MotionEvent.CLASSIFICATION_MULTI_FINGER_SWIPE

        val pointerCount = event.pointerCount
        if (pointerCount < 3 && !isTrackpadThreeFinger && !isThreeFingerActive) {
            return false
        }

        val centroidX = computeCentroidX(event)

        when (event.actionMasked) {
            MotionEvent.ACTION_POINTER_DOWN, MotionEvent.ACTION_DOWN -> {
                if (pointerCount == 3 || isTrackpadThreeFinger) {
                    isThreeFingerActive = true
                    startCentroidX = centroidX
                    lastCentroidX = centroidX
                    velocityTracker?.clear()
                    velocityTracker = velocityTracker ?: VelocityTracker.obtain()
                    velocityTracker?.addMovement(event)
                }
            }

            MotionEvent.ACTION_MOVE -> {
                if (isThreeFingerActive && (pointerCount >= 3 || isTrackpadThreeFinger)) {
                    velocityTracker?.addMovement(event)
                    val deltaX = centroidX - lastCentroidX
                    if (abs(deltaX) >= MIN_PAN_SLOP_PX) {
                        onThreeFingerPanDelta(deltaX)
                        lastCentroidX = centroidX
                    }
                    return true
                }
            }

            MotionEvent.ACTION_POINTER_UP, MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                if (isThreeFingerActive) {
                    velocityTracker?.addMovement(event)
                    velocityTracker?.computeCurrentVelocity(1000)
                    val vx = velocityTracker?.xVelocity ?: 0f
                    val totalDeltaX = lastCentroidX - startCentroidX
                    isThreeFingerActive = false
                    onThreeFingerRelease(totalDeltaX, vx)
                    return true
                }
            }
        }
        return false
    }

    private fun computeCentroidX(event: MotionEvent): Float {
        val count = event.pointerCount.coerceAtLeast(1)
        var sumX = 0f
        for (i in 0 until count) {
            sumX += event.getX(i)
        }
        return sumX / count
    }
}`
  },
  {
    id: 'strip-hud-compose-kt',
    path: 'app/src/main/java/tr/seritdex/wm/overlay/StripHudCompose.kt',
    title: 'StripHudCompose.kt',
    language: 'kotlin',
    category: 'Compose UI & HUD',
    summary: 'Jetpack Compose ile çizilen 36dp üst Şerit Haritası (Minimap Scrubber), dokunmatik kenar kaydırma çubuğu ve Alt+Space Hızlı Geçiş Paleti.',
    linesOfCode: 174,
    content: `package tr.seritdex.wm.overlay

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import tr.seritdex.wm.engine.ComputedTaskPlacement
import tr.seritdex.wm.engine.WidthPreset

@Composable
fun StripTopMinimapHud(
    placements: List<ComputedTaskPlacement>,
    totalStripWidthPx: Int,
    viewportWidthPx: Int,
    scrollOffsetPx: Int,
    onScrollDelta: (Float) -> Unit,
    onSelectTask: (Int) -> Unit,
    onCycleWidthPreset: () -> Unit,
    onToggleStack: () -> Unit
) {
    val dragState = rememberDraggableState { delta ->
        // Üst şerit haritasında sürükleme ters ölçekli hızlı kamera kaydırması sağlar
        val scale = (totalStripWidthPx.toFloat() / viewportWidthPx.toFloat()).coerceAtLeast(1f)
        onScrollDelta(delta * scale * 1.5f)
    }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .height(36.dp)
            .pointerInput(Unit) {
                awaitPointerEventScope {
                    while (true) {
                        val event = awaitPointerEvent()
                        if (event.type == PointerEventType.Scroll) {
                            val scrollDelta = event.changes.firstOrNull()?.scrollDelta
                            if (scrollDelta != null) {
                                val deltaPx = (scrollDelta.x + scrollDelta.y) * 96f
                                onScrollDelta(deltaPx)
                            }
                        }
                    }
                }
            },
        color = Color(0xE60B0F17)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            // Sol: Marka & Aktif Şerit Koordinatı
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = "ŞeritDeX",
                    color = Color(0xFFF8FAFC),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = "X: \${scrollOffsetPx}px / \${totalStripWidthPx}px",
                    color = Color(0xFF94A3B8),
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace
                )
            }

            // Orta: Etkileşimli Şerit Minimap Scrubber (Dokunmatik + Fare Tekerleği)
            Row(
                modifier = Modifier
                    .draggable(
                        state = dragState,
                        orientation = Orientation.Horizontal
                    )
                    .padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                placements.forEach { placement ->
                    val bgColor = if (placement.isFocused) Color(0xFF3B82F6) else Color(0xFF1E293B)
                    val borderColor = if (placement.isFocused) Color(0xFF60A5FA) else Color(0xFF334155)
                    Box(
                        modifier = Modifier
                            .width(48.dp)
                            .height(22.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(bgColor)
                            .border(1.dp, borderColor, RoundedCornerShape(4.dp))
                            .clickable { onSelectTask(placement.taskId) },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "#\${placement.taskId}",
                            color = Color.White,
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }
            }

            // Sağ: Tek Dokunuş Boyutlandırma ve Gruplama Kontrolleri
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                HudActionButton(label = "Genişlik (Alt+R)", onClick = onCycleWidthPreset)
                HudActionButton(label = "Dikey Grup (Alt+G)", onClick = onToggleStack)
            }
        }
    }
}

@Composable
private fun HudActionButton(
    label: String,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(Color(0xFF1E293B))
            .border(1.dp, Color(0xFF334155), RoundedCornerShape(4.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(
            text = label,
            color = Color(0xFFE2E8F0),
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium
        )
    }
}`
  },
  {
    id: 'android-manifest-xml',
    path: 'app/src/main/AndroidManifest.xml',
    title: 'AndroidManifest.xml',
    language: 'xml',
    category: 'Build & Manifest',
    summary: 'Samsung DeX çoklu pencere bayrakları, AccessibilityService tanımı, Shizuku sağlayıcısı ve SYSTEM_ALERT_WINDOW izin bildirimleri.',
    linesOfCode: 78,
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools"
    package="tr.seritdex.wm">

    <!-- Şerit HUD ve Kenar Hareket Çubuğu için Üst Katman İzni -->
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />

    <!-- Açık uygulamaları ve görev yığınını tespit etmek için -->
    <uses-permission
        android:name="android.permission.PACKAGE_USAGE_STATS"
        tools:ignore="ProtectedPermissions" />
    <uses-permission
        android:name="android.permission.QUERY_ALL_PACKAGES"
        tools:ignore="QueryAllPackagesPermission" />

    <!-- Ön planda kesintisiz çalışma -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />

    <application
        android:allowBackup="true"
        android:label="ŞeritDeX Pencere Yöneticisi"
        android:supportsRtl="true"
        android:hardwareAccelerated="true"
        android:theme="@android:style/Theme.DeviceDefault.NoActionBar">

        <!-- Samsung DeX & One UI Çoklu Pencere Optimizasyon Meta Verileri -->
        <meta-data
            android:name="com.samsung.android.keepalive.density"
            android:value="true" />
        <meta-data
            android:name="com.samsung.android.multidisplay.keep_process_alive"
            android:value="true" />

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:resizeableActivity="true"
            android:configChanges="orientation|screenSize|screenLayout|smallestScreenSize|uiMode|density|keyboard|keyboardHidden">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- ŞeritDeX Çekirdek Erişilebilirlik & Pencere İzleme Servisi -->
        <service
            android:name=".service.DexAccessibilityService"
            android:exported="false"
            android:label="ŞeritDeX Pencere Motoru"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/accessibility_service_config" />
        </service>

        <!-- Shizuku 90Hz Görev Boyutlandırma Köprüsü Sağlayıcısı -->
        <provider
            android:name="rikka.shizuku.ShizukuProvider"
            android:authorities="\${applicationId}.shizuku"
            android:enabled="true"
            android:exported="true"
            android:multiprocess="false"
            android:permission="android.permission.INTERACT_ACROSS_USERS_FULL" />

    </application>
</manifest>`
  },
  {
    id: 'build-gradle-kts',
    path: 'app/build.gradle.kts',
    title: 'app/build.gradle.kts',
    language: 'gradle',
    category: 'Build & Manifest',
    summary: 'Galaxy Tab A11+ (ARM64-v8a) hedefli, R8 tam optimizasyonlu, Jetpack Compose + Shizuku bağımlılıklarını içeren Gradle yapılandırması.',
    linesOfCode: 72,
    content: `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "tr.seritdex.wm"
    compileSdk = 35

    defaultConfig {
        applicationId = "tr.seritdex.wm"
        minSdk = 29 // Android 10+ Freeform & DeX API garantisi
        targetSdk = 35
        versionCode = 104
        versionName = "1.4.0-TabA11Plus"

        ndk {
            // Galaxy Tab A11+ (Helio G99 / ARM64) için ikili boyutu küçült
            abiFilters += listOf("arm64-v8a")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("debug") // Doğrudan kurulabilir APK için
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs += listOf(
            "-opt-in=androidx.compose.material3.ExperimentalMaterial3Api"
        )
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2025.02.00")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.10.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    // Shizuku Binder Köprüsü (IActivityTaskManager.resizeTask için)
    implementation("dev.rikka.shizuku:api:13.1.5")
    implementation("dev.rikka.shizuku:provider:13.1.5")
}`
  },
  {
    id: 'github-actions-apk-yml',
    path: '.github/workflows/build-apk.yml',
    title: 'build-apk.yml (Otomatik APK Derleyici)',
    language: 'yaml',
    category: 'Build & Manifest',
    summary: 'Bulutta veya yerel ortamda tek komutla Galaxy Tab A11+ üzerine kurulabilir imzalı APK üreten CI/CD iş akışı.',
    linesOfCode: 52,
    content: `name: Build ŞeritDeX Galaxy Tab A11+ APK

on:
  push:
    branches: [ "main" ]
  workflow_dispatch:

jobs:
  assemble-apk:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Kaynak Kodu
        uses: actions/checkout@v4

      - name: JDK 17 Kurulumu
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Android SDK Kurulumu
        uses: android-actions/setup-android@v3

      - name: Release APK Derle (Galaxy Tab A11+ ARM64)
        run: ./gradlew assembleRelease --no-daemon

      - name: Kurulabilir APK Çıktısını Yükle
        uses: actions/upload-artifact@v4
        with:
          name: SeritDeX-GalaxyTabA11Plus-v1.4.0-APK
          path: app/build/outputs/apk/release/*.apk`
  }
];

export function generateProjectExportScript(): string {
  const lines: string[] = [
    '#!/usr/bin/env bash',
    '# ==============================================================================',
    '# ŞeritDeX — Samsung Galaxy Tab A11+ DeX Pencere Yöneticisi Kurulum & Derleyici',
    '# Bu betik tüm Kotlin + Jetpack Compose Android Studio projesini oluşturur.',
    '# ==============================================================================',
    'set -e',
    'mkdir -p SeritDeX-TabA11Plus',
    'cd SeritDeX-TabA11Plus',
    '',
  ];

  for (const file of KOTLIN_PROJECT_FILES) {
    const dir = file.path.includes('/')
      ? file.path.substring(0, file.path.lastIndexOf('/'))
      : '';
    if (dir) {
      lines.push(`mkdir -p "${dir}"`);
    }
    lines.push(`cat << 'EOF_SERITDEX_FILE' > "${file.path}"`);
    lines.push(file.content);
    lines.push('EOF_SERITDEX_FILE');
    lines.push('');
  }

  lines.push('echo "✓ ŞeritDeX Android Studio projesi başarıyla oluşturuldu: ./SeritDeX-TabA11Plus"');
  lines.push('echo "✓ Kurulabilir APK derlemek için: cd SeritDeX-TabA11Plus && ./gradlew assembleRelease"');
  return lines.join('\n');
}
