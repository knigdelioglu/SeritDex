package tr.seritdex.wm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StripLayoutTest {
    @Test fun everyWindowStaysInsideDisplayWhenNavigating() {
        val ids = (1..8).toList()
        for (width in listOf(1200, 1920)) {
            for (fraction in listOf(0.3333f, 0.5f, 0.6667f, 1f)) {
                for (selected in ids.indices) {
                    val slots = StripLayout.slots(ids, width, selected, fraction, 12)
                    assertFalse(slots[selected].parked)
                    slots.forEach {
                        assertTrue(it.left >= 0)
                        assertTrue(it.left + it.width <= width)
                    }
                }
            }
        }
    }

    @Test fun twoHalfWidthWindowsFitWithGap() {
        val slots = StripLayout.slots(listOf(1, 2, 3), 1920, 1, 0.5f, 12)
        assertEquals(0, slots[0].left)
        assertEquals(slots[0].width + 12, slots[1].left)
        assertEquals(1920, slots[1].left + slots[1].width)
        assertTrue(slots[2].parked)
    }

    @Test fun navigatingBackRecoversFirstWindows() {
        val ids = (1..5).toList()
        val last = StripLayout.slots(ids, 1920, 4, 0.5f, 12)
        assertTrue(last[0].parked)
        val first = StripLayout.slots(ids, 1920, 0, 0.5f, 12)
        assertFalse(first[0].parked)
        assertFalse(first[1].parked)
        assertEquals(0, first[0].left)
    }
}
