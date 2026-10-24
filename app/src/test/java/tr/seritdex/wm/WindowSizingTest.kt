package tr.seritdex.wm

import org.junit.Assert.assertEquals
import org.junit.Test

class WindowSizingTest {
    @Test fun halfAndFull() {
        assertEquals(960, WindowSizing.targetWidth(1920, 0.5f))
        assertEquals(1920, WindowSizing.targetWidth(1920, 1f))
    }
    @Test fun clamping() {
        assertEquals(1920, WindowSizing.targetWidth(1920, 2f))
        assertEquals(1, WindowSizing.targetWidth(0, 0.5f))
    }
}
