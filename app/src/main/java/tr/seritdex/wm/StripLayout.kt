package tr.seritdex.wm

import android.graphics.Rect
import kotlin.math.max

/** Virtual strip coordinates can scroll, but actual windows stay inside the display. */
data class StripPlacement(
    val taskId: Int,
    val logicalBounds: Rect,
    val requestedBounds: Rect,
    val parked: Boolean
)

object StripLayout {
    internal data class Slot(val taskId: Int, val logicalLeft: Int, val left: Int, val width: Int, val parked: Boolean)

    internal fun slots(taskIds: List<Int>, viewportWidth: Int, focusedIndex: Int,
                       fraction: Float, gap: Int): List<Slot> {
        if (taskIds.isEmpty()) return emptyList()
        val w = viewportWidth.coerceAtLeast(320)
        val ratio = fraction.coerceIn(0.3333f, 1f)
        val spacing = gap.coerceIn(0, w / 10)
        val columns = (1f / ratio + 0.001f).toInt().coerceIn(1, 3)
        val width = ((w - spacing * (columns - 1)) * ratio).toInt().coerceIn(1, w)
        val step = width + spacing
        val active = focusedIndex.coerceIn(0, taskIds.lastIndex)
        // Scroll only far enough to reveal the selected window in full.
        val offset = (active * step + width - w).coerceAtLeast(0)
        return taskIds.mapIndexed { index, id ->
            val rawLeft = index * step - offset
            val left = rawLeft.coerceIn(0, w - width)
            Slot(id, index * step, left, width, rawLeft != left)
        }
    }

    fun placements(
        taskIds: List<Int>,
        viewportWidth: Int,
        viewportHeight: Int,
        focusedIndex: Int,
        fraction: Float = 0.5f,
        gap: Int = 12
    ): List<StripPlacement> {
        if (taskIds.isEmpty()) return emptyList()
        val w = viewportWidth.coerceAtLeast(320)
        val h = viewportHeight.coerceAtLeast(320)
        val heightTop = max(0, (h * 0.06f).toInt())
        val heightBottom = (h - max(70, (h * 0.09f).toInt())).coerceAtLeast(heightTop + 100)
        return slots(taskIds, w, focusedIndex, fraction, gap).map { slot ->
            val logical = Rect(slot.logicalLeft, heightTop, slot.logicalLeft + slot.width, heightBottom)
            val target = Rect(slot.left, heightTop, slot.left + slot.width, heightBottom)
            StripPlacement(slot.taskId, logical, target, slot.parked)
        }
    }
}
