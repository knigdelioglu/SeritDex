package tr.seritdex.wm

object WindowSizing {
    fun targetWidth(displayWidth: Int, ratio: Float): Int =
        (displayWidth.coerceAtLeast(1) * ratio.coerceIn(0.3333f, 1f)).toInt().coerceAtLeast(1)

    /** Occupied pairs contain left and exclusive right coordinates in display pixels. */
    fun targetLeft(displayWidth: Int, targetWidth: Int, occupied: List<Pair<Int, Int>>): Int {
        val screen = displayWidth.coerceAtLeast(1)
        val width = targetWidth.coerceIn(1, screen)
        val lastLeft = screen - width
        val spans = occupied.mapNotNull { (left, right) ->
            val start = left.coerceIn(0, screen)
            val end = right.coerceIn(0, screen)
            if (end > start) start to end else null
        }
        // Overlap changes at window edges. Prefer the leftmost free area, or
        // the least occupied area when no space can fit the requested width.
        val candidates = (listOf(0, lastLeft) + spans.flatMap { (left, right) ->
            listOf((left - width).coerceIn(0, lastLeft), right.coerceIn(0, lastLeft))
        }).distinct().sorted()
        return candidates.minBy { x ->
            spans.sumOf { (left, right) ->
                (minOf(x + width, right) - maxOf(x, left)).coerceAtLeast(0).toLong()
            }
        }
    }
}
