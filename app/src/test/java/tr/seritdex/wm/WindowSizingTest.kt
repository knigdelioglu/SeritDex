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
    @Test fun newWindowsUseAdjacentFreeSpace() {
        assertEquals(0, WindowSizing.targetLeft(1920, 960, emptyList()))
        assertEquals(960, WindowSizing.targetLeft(1920, 960, listOf(0 to 960)))
        assertEquals(0, WindowSizing.targetLeft(1920, 960, listOf(960 to 1920)))
        assertEquals(1280, WindowSizing.targetLeft(1920, 640, listOf(0 to 640, 640 to 1280)))
    }
    @Test fun occupiedScreenUsesLeastOverlapWithinDisplay() {
        assertEquals(960, WindowSizing.targetLeft(1920, 960, listOf(0 to 1200)))
        assertEquals(0, WindowSizing.targetLeft(1920, 1920, listOf(0 to 960)))
    }
    @Test fun offscreenAndInvalidBoundsDoNotOccupySpace() {
        assertEquals(0, WindowSizing.targetLeft(1920, 960,
            listOf(-800 to 0, 1920 to 2400, 500 to 100, 0 to 0)))
        assertEquals(0, WindowSizing.targetLeft(0, 0, emptyList()))
    }
}
