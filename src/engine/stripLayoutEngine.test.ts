import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TAB_A11_PLUS_CONFIG,
  StripWorkspaceState,
  computeStripLayout,
  focusWindowAndScroll,
  computeScrollToFocusWindow,
  cycleFocusHorizontal,
  cycleActiveColumnWidth,
  toggleStackWindowWithNeighbor,
  moveActiveColumnInStrip,
  computeSnapDropTarget,
  applySnapDropAction,
  swapGroupStackOrder,
  setColumnSplitRatio,
  unstackEntireGroup,
  toggleWindowFullscreen,
  resizeWindowInStrip,
  computeSpringCurve,
  applyThreeFingerPanDelta,
  resolveThreeFingerSwipeRelease,
} from './stripLayoutEngine';

function createSampleState(): StripWorkspaceState {
  return {
    config: { ...DEFAULT_TAB_A11_PLUS_CONFIG },
    windows: {
      w1: {
        id: 'w1',
        taskId: 101,
        packageName: 'com.samsung.android.app.notes',
        activityName: '.MainActivity',
        title: 'Samsung Notes',
        subtitle: 'DeX Mimari Notları.sdocx',
        category: 'productivity',
        accentColor: '#3B82F6',
        memoryMb: 142,
        isPinnedPip: false,
        isMinimized: false,
        lastFocusedAt: 1000,
      },
      w2: {
        id: 'w2',
        taskId: 102,
        packageName: 'com.termux',
        activityName: '.app.TermuxActivity',
        title: 'Termux — Kotlin ADB Shell',
        subtitle: 'shizuku_binder @ tab-a11-plus',
        category: 'development',
        accentColor: '#10B981',
        memoryMb: 96,
        isPinnedPip: false,
        isMinimized: false,
        lastFocusedAt: 2000,
      },
      w3: {
        id: 'w3',
        taskId: 103,
        packageName: 'com.android.chrome',
        activityName: 'com.google.android.apps.chrome.Main',
        title: 'Chrome DeX',
        subtitle: 'developer.android.com/guide/topics/ui/multi-window',
        category: 'browser',
        accentColor: '#F59E0B',
        memoryMb: 310,
        isPinnedPip: false,
        isMinimized: false,
        lastFocusedAt: 3000,
      },
    },
    columns: [
      { id: 'c1', widthPreset: '1/2', windowIds: ['w1'], splitRatio: 0.5 },
      { id: 'c2', widthPreset: '2/3', windowIds: ['w2'], splitRatio: 0.5 },
      { id: 'c3', widthPreset: '1/2', windowIds: ['w3'], splitRatio: 0.5 },
    ],
    focusedWindowId: 'w1',
    scrollOffsetPx: 0,
  };
}

test('computeStripLayout calculates non-overlapping horizontal coordinates on 1920x1200 WUXGA', () => {
  const state = createSampleState();
  const layout = computeStripLayout(state);

  assert.equal(layout.placements.length, 3);
  const [p1, p2, p3] = layout.placements;

  assert.equal(p1.stripRect.left, 14);
  assert.ok(p2.stripRect.left > p1.stripRect.right);
  assert.ok(p3.stripRect.left > p2.stripRect.right);
  assert.ok(layout.totalStripWidthPx > 1920);
  assert.ok(layout.maxScrollOffsetPx > 0);
});

test('computeScrollToFocusWindow centers middle window and clamps edge windows', () => {
  const state = createSampleState();
  const scrollW1 = computeScrollToFocusWindow(state, 'w1', 'center');
  assert.equal(scrollW1, 0);

  const scrollW2 = computeScrollToFocusWindow(state, 'w2', 'center');
  assert.ok(scrollW2 > 0);

  const layoutAtW2 = computeStripLayout({ ...state, scrollOffsetPx: scrollW2 });
  const w2Placement = layoutAtW2.placementByWindowId['w2'];
  assert.equal(w2Placement.visibilityState, 'fully_visible');
});

test('cycleFocusHorizontal moves focus sequentially across strip and updates scroll', () => {
  const state = createSampleState();
  const next1 = cycleFocusHorizontal(state, 1);
  assert.equal(next1.focusedWindowId, 'w2');
  assert.ok(next1.scrollOffsetPx > 0);

  const next2 = cycleFocusHorizontal(next1, 1);
  assert.equal(next2.focusedWindowId, 'w3');

  const wrapAround = cycleFocusHorizontal(next2, 1);
  assert.equal(wrapAround.focusedWindowId, 'w1');
  assert.equal(wrapAround.scrollOffsetPx, 0);
});

test('cycleActiveColumnWidth cycles preset 1/2 -> 2/3 -> full -> 1/3', () => {
  const state = createSampleState();
  const s1 = cycleActiveColumnWidth(state);
  assert.equal(s1.columns[0].widthPreset, '2/3');

  const s2 = cycleActiveColumnWidth(s1);
  assert.equal(s2.columns[0].widthPreset, 'full');

  const s3 = cycleActiveColumnWidth(s2);
  assert.equal(s3.columns[0].widthPreset, '1/3');
});

test('toggleStackWindowWithNeighbor merges 2 adjacent columns vertically and unstacks cleanly', () => {
  const state = createSampleState();
  const stacked = toggleStackWindowWithNeighbor(state, 'w1');

  assert.equal(stacked.columns.length, 2);
  assert.deepEqual(stacked.columns[0].windowIds, ['w1', 'w2']);

  const layout = computeStripLayout(stacked);
  const p1 = layout.placementByWindowId['w1'];
  const p2 = layout.placementByWindowId['w2'];

  // Same horizontal bounds, stacked vertically with gap
  assert.equal(p1.stripRect.left, p2.stripRect.left);
  assert.equal(p1.stripRect.right, p2.stripRect.right);
  assert.ok(p2.stripRect.top > p1.stripRect.bottom);

  // Unstack w1 back into separate columns
  const unstacked = toggleStackWindowWithNeighbor(stacked, 'w1');
  assert.equal(unstacked.columns.length, 3);
});

test('moveActiveColumnInStrip swaps active column position along the strip', () => {
  const state = createSampleState();
  const movedRight = moveActiveColumnInStrip(state, 1);
  assert.deepEqual(
    movedRight.columns.map((c) => c.id),
    ['c2', 'c1', 'c3']
  );
});

test('computeSnapDropTarget and applySnapDropAction support magnetic Snap-to-Group and Edge-Snap', () => {
  const state = createSampleState();
  const layout = computeStripLayout(state);
  const p2 = layout.placementByWindowId['w2'];

  // Hover w1 over the center-bottom of w2 -> should detect stack_bottom on c2
  const centerW2X = Math.round((p2.screenRect.left + p2.screenRect.right) / 2);
  const bottomHalfY = Math.round((p2.screenRect.top + p2.screenRect.bottom) * 0.75);

  const snapTarget = computeSnapDropTarget(state, layout, 'w1', centerW2X, bottomHalfY);
  assert.ok(snapTarget);
  assert.equal(snapTarget.targetColumnId, 'c2');
  assert.equal(snapTarget.zone, 'stack_bottom');

  const groupedState = applySnapDropAction(state, snapTarget);
  assert.equal(groupedState.columns.length, 2);
  assert.deepEqual(groupedState.columns[0].windowIds, ['w2', 'w1']);

  // Now drag w1 to the left edge of its stacked column -> unstacks into a standalone column on the left
  const groupedLayout = computeStripLayout(groupedState);
  const stackedP = groupedLayout.placementByWindowId['w1'];
  const unstackTarget = computeSnapDropTarget(
    groupedState,
    groupedLayout,
    'w1',
    stackedP.screenRect.left + 20,
    300
  );
  assert.ok(unstackTarget);
  assert.equal(unstackTarget.zone, 'snap_left');

  const unstackedState = applySnapDropAction(groupedState, unstackTarget);
  assert.equal(unstackedState.columns.length, 3);
  assert.deepEqual(unstackedState.columns[0].windowIds, ['w1']);
  assert.deepEqual(unstackedState.columns[1].windowIds, ['w2']);
});

test('Group-View container computation, swap order, split ratio, and unstackEntireGroup work accurately', () => {
  const state = toggleStackWindowWithNeighbor(createSampleState(), 'w1');
  const layout = computeStripLayout(state);

  assert.equal(layout.groupContainers.length, 1);
  const group = layout.groupContainers[0];
  assert.deepEqual(group.windowIds, ['w1', 'w2']);
  assert.equal(group.totalMemoryMb, 142 + 96);

  // Swap stack order
  const swapped = swapGroupStackOrder(state, group.columnId);
  assert.deepEqual(swapped.columns[0].windowIds, ['w2', 'w1']);

  // Set split ratio to 0.35
  const resizedSplit = setColumnSplitRatio(swapped, group.columnId, 0.35);
  assert.equal(resizedSplit.columns[0].splitRatio, 0.35);

  // Unstack entire group
  const dissolved = unstackEntireGroup(resizedSplit, group.columnId);
  assert.equal(dissolved.columns.length, 3);
});

test('toggleWindowFullscreen maximizes standalone or stacked window to full width and restores on second toggle', () => {
  const state = createSampleState();
  // Maximize w1 (initially '1/2') -> becomes 'full'
  const fullState = toggleWindowFullscreen(state, 'w1');
  const colW1 = fullState.columns.find((c) => c.windowIds.includes('w1'))!;
  assert.equal(colW1.widthPreset, 'full');
  assert.equal(fullState.focusedWindowId, 'w1');

  // Toggle again -> restores to '1/2'
  const restoredState = toggleWindowFullscreen(fullState, 'w1');
  const colW1Restored = restoredState.columns.find((c) => c.windowIds.includes('w1'))!;
  assert.equal(colW1Restored.widthPreset, '1/2');
});

test('resizeWindowInStrip updates column customWidthRatio, customHeightRatio, stripRect, and stacked splitRatio', () => {
  const state = createSampleState();
  const resized = resizeWindowInStrip(state, {
    windowId: 'w1',
    newWidthPx: 1240,
    newHeightPx: 720,
  });

  const colW1 = resized.columns.find((c) => c.windowIds.includes('w1'))!;
  assert.ok(colW1.customWidthRatio);
  assert.ok(colW1.customHeightRatio);
  assert.equal(colW1.widthPreset, '2/3');

  const layout = computeStripLayout(resized);
  const p1 = layout.placementByWindowId['w1'];
  assert.equal(p1.stripRect.right - p1.stripRect.left, 1240);
  assert.equal(p1.stripRect.bottom - p1.stripRect.top, 720);

  // Stacked group top window resize adjusts splitRatio and column width
  const grouped = toggleStackWindowWithNeighbor(createSampleState(), 'w1');
  const resizedGroup = resizeWindowInStrip(grouped, {
    windowId: 'w1',
    newWidthPx: 1100,
    newHeightPx: 320,
  });
  assert.equal(
    computeStripLayout(resizedGroup).placementByWindowId['w1'].stripRect.right -
      computeStripLayout(resizedGroup).placementByWindowId['w1'].stripRect.left,
    1100
  );
  assert.notEqual(resizedGroup.columns[0].splitRatio, 0.5);
});

test('computeSpringCurve generates underdamped Hooke spring linear() easing with overshoot for drag and resize', () => {
  const balanced = computeSpringCurve('dex_90hz_balanced');
  assert.ok(balanced.dampingRatio < 1);
  assert.ok(balanced.peakOvershootPct > 0);
  assert.ok(balanced.easingCss.startsWith('linear(0,'));
  assert.ok(balanced.transitionCss.includes(balanced.easingCss));
  assert.ok(balanced.activeDragTransitionCss.includes('transform'));
  assert.ok(balanced.activeResizeTransitionCss.includes('width'));

  const bouncy = computeSpringCurve('elastic_bouncy');
  assert.ok(bouncy.peakOvershootPct > balanced.peakOvershootPct);
});

test('3-finger gesture engine supports continuous 90Hz pan, fast fling column switch, and slow magnetic snap', () => {
  const state = createSampleState();

  // 1. Continuous 3-finger pan left (-200px) pulls strip camera right (+250px)
  const panned = applyThreeFingerPanDelta(state, -200, 1.25);
  assert.equal(panned.scrollOffsetPx, 250);

  // 2. Fast 3-finger fling left (-240px in 180ms -> -1333px/s) jumps focus from w1 to w2
  const flingNext = resolveThreeFingerSwipeRelease(
    state,
    -240,
    180,
    'hybrid_pan_and_fling'
  );
  assert.equal(flingNext.isFling, true);
  assert.equal(flingNext.gestureAction, 'fling_next_column');
  assert.equal(flingNext.nextState.focusedWindowId, 'w2');
  assert.ok(flingNext.appliedScrollOffsetPx > 0);

  // 3. Fast 3-finger fling right (+260px in 200ms -> +1300px/s) jumps focus back from w2 to w1
  const flingPrev = resolveThreeFingerSwipeRelease(
    flingNext.nextState,
    260,
    200,
    'hybrid_pan_and_fling'
  );
  assert.equal(flingPrev.isFling, true);
  assert.equal(flingPrev.gestureAction, 'fling_prev_column');
  assert.equal(flingPrev.nextState.focusedWindowId, 'w1');
  assert.equal(flingPrev.appliedScrollOffsetPx, 0);

  // 4. Slow 3-finger pan release near column 2 magnetically snaps to w2
  const manuallyPannedNearW2 = {
    ...state,
    scrollOffsetPx: 620,
  };
  const magneticSnap = resolveThreeFingerSwipeRelease(
    manuallyPannedNearW2,
    -40,
    600,
    'hybrid_pan_and_fling'
  );
  assert.equal(magneticSnap.isFling, false);
  assert.equal(magneticSnap.gestureAction, 'magnetic_column_snap');
  assert.equal(magneticSnap.nextState.focusedWindowId, 'w2');
});

test('resizing respects the requested minimum width and narrow viewports', () => {
  for (const viewportWidth of [1920, 320]) {
    const state = createSampleState();
    state.config.viewportWidth = viewportWidth;
    const usableWidth = viewportWidth - state.config.outerMarginPx * 2;
    const resized = resizeWindowInStrip(state, {
      windowId: 'w1', newWidthPx: 380, newHeightPx: 500,
    });
    const rect = computeStripLayout(resized).placementByWindowId.w1.stripRect;
    assert.equal(rect.right - rect.left, Math.min(380, usableWidth));
    const originalRect = computeStripLayout(state).placementByWindowId.w1.stripRect;
    assert.ok(originalRect.right - originalRect.left <= usableWidth);
  }
});

test('focusing a pinned window restores it to the strip', () => {
  const state = createSampleState();
  state.windows.w2.isPinnedPip = true;
  const focused = focusWindowAndScroll(state, 'w2');
  assert.equal(focused.windows.w2.isPinnedPip, false);
  assert.ok(computeStripLayout(focused).placementByWindowId.w2);
});

test('three-finger fling skips minimized and pinned columns', () => {
  for (const flag of ['isMinimized', 'isPinnedPip'] as const) {
    const state = createSampleState();
    state.windows.w2[flag] = true;
    const next = resolveThreeFingerSwipeRelease(state, -240, 180).nextState;
    assert.equal(next.focusedWindowId, 'w3');
    assert.equal(next.windows.w2[flag], true);
    const previous = resolveThreeFingerSwipeRelease(next, 240, 180).nextState;
    assert.equal(previous.focusedWindowId, 'w1');
  }
});






