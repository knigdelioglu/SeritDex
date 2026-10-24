package tr.seritdex.wm

import android.graphics.Rect
import kotlin.math.max

/** Logical coordinates are unrestricted. Edge-parked bounds leave a reachable title strip.
 * Placement is independent from whether the OEM accepts actual task resizing.
 */
data class StripPlacement(
    val taskId: Int,
    val logicalBounds: Rect,
    val requestedBounds: Rect,
    val parked: Boolean
)

object StripLayout {
    fun placements(
        taskIds: List<Int>,
        viewportWidth: Int,
        viewportHeight: Int,
        focusedIndex: Int,
        fraction: Float = 0.5f,
        gap: Int = 12,
        edgePeek: Int = 24
    ): List<StripPlacement> {
        if (taskIds.isEmpty()) return emptyList()
        val w = viewportWidth.coerceAtLeast(320)
        val h = viewportHeight.coerceAtLeast(320)
        val width = (w * fraction.coerceIn(0.3333f, 1f)).toInt().coerceIn(1, w)
        val heightTop = max(0, (h * 0.06f).toInt())
        val heightBottom = (h - max(70, (h * 0.09f).toInt())).coerceAtLeast(heightTop + 100)
        val step = width + gap.coerceAtLeast(0)
        val active = focusedIndex.coerceIn(0, taskIds.lastIndex)
        val activeCenter = active * step + width / 2
        val virtualWidth = taskIds.size * step - gap.coerceAtLeast(0)
        val offset = (activeCenter - w / 2).coerceIn(0, (virtualWidth - w).coerceAtLeast(0))
        return taskIds.mapIndexed { index, id ->
            val logical = Rect(index * step, heightTop, index * step + width, heightBottom)
            val left = index * step - offset
            val raw = Rect(left, heightTop, left + width, heightBottom)
            val offLeft = raw.right <= 0
            val offRight = raw.left >= w
            val target = when {
                offLeft -> Rect(-width + edgePeek, heightTop, edgePeek, heightBottom)
                offRight -> Rect(w - edgePeek, heightTop, w - edgePeek + width, heightBottom)
                else -> raw
            }
            StripPlacement(id, logical, target, offLeft || offRight)
        }
    }
}
