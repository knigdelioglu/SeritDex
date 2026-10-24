export type WidthPreset = '1/3' | '1/2' | '2/3' | 'full';

export type ExecutionBackend = 'shizuku_binder' | 'standard_launch_bounds';

export type ScrollFocusMode = 'center' | 'edge_snap';

export type AppCategory = 'productivity' | 'development' | 'browser' | 'files' | 'media' | 'system';

export interface DexAppWindow {
  id: string;
  taskId: number;
  packageName: string;
  activityName: string;
  title: string;
  subtitle: string;
  category: AppCategory;
  accentColor: string;
  memoryMb: number;
  isPinnedPip: boolean;
  isMinimized: boolean;
  lastFocusedAt: number;
}

export interface StripColumn {
  id: string;
  widthPreset: WidthPreset;
  customWidthRatio?: number;
  customHeightRatio?: number; // 0.35 to 1.0 of usable workspace height
  windowIds: string[]; // 1 window or 2 stacked windows
  splitRatio: number; // default 0.5 for 2 vertically stacked windows
}

export interface AndroidRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type WindowVisibilityState = 'fully_visible' | 'partially_visible' | 'offscreen_parked';

export interface ComputedWindowPlacement {
  windowId: string;
  columnId: string;
  columnIndex: number;
  stackIndex: number;
  stackCount: number;
  stripRect: AndroidRect;
  screenRect: AndroidRect;
  dexAppliedRect: AndroidRect;
  visibilityState: WindowVisibilityState;
  visibleRatio: number;
  isFocused: boolean;
}

export interface StripWorkspaceConfig {
  viewportWidth: number; // 1920 for Galaxy Tab A11+ WUXGA
  viewportHeight: number; // 1200 for Galaxy Tab A11+ WUXGA
  topHudHeight: number; // 36px
  bottomDockHeight: number; // 56px
  outerMarginPx: number; // 14px
  columnGapPx: number; // 14px
  stackGapPx: number; // 12px
  executionBackend: ExecutionBackend;
  scrollFocusMode: ScrollFocusMode;
}

export interface StripWorkspaceState {
  config: StripWorkspaceConfig;
  windows: Record<string, DexAppWindow>;
  columns: StripColumn[];
  focusedWindowId: string | null;
  scrollOffsetPx: number;
}

export interface ComputedColumnGroupContainer {
  groupId: string;
  columnId: string;
  columnIndex: number;
  windowIds: string[];
  widthPreset: WidthPreset;
  splitRatio: number;
  stripContainerRect: AndroidRect;
  screenContainerRect: AndroidRect;
  dividerScreenY: number;
  isFocusedGroup: boolean;
  totalMemoryMb: number;
}

export interface ComputedStripLayout {
  totalStripWidthPx: number;
  maxScrollOffsetPx: number;
  usableWorkHeightPx: number;
  usableTopPx: number;
  usableBottomPx: number;
  placements: ComputedWindowPlacement[];
  placementByWindowId: Record<string, ComputedWindowPlacement>;
  groupContainers: ComputedColumnGroupContainer[];
  visibleWindowCount: number;
  offscreenWindowCount: number;
  estimatedOverlayRamMb: number;
}

export const DEFAULT_TAB_A11_PLUS_CONFIG: StripWorkspaceConfig = {
  viewportWidth: 1920,
  viewportHeight: 1200,
  topHudHeight: 36,
  bottomDockHeight: 56,
  outerMarginPx: 14,
  columnGapPx: 14,
  stackGapPx: 12,
  executionBackend: 'shizuku_binder',
  scrollFocusMode: 'center',
};

export function presetToRatio(preset: WidthPreset): number {
  switch (preset) {
    case '1/3':
      return 0.3333;
    case '1/2':
      return 0.5;
    case '2/3':
      return 0.6667;
    case 'full':
      return 1.0;
  }
}

export function getNextWidthPreset(current: WidthPreset): WidthPreset {
  const order: WidthPreset[] = ['1/3', '1/2', '2/3', 'full'];
  const idx = order.indexOf(current);
  return order[(idx + 1) % order.length];
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function computeColumnWidthPx(
  column: StripColumn,
  config: StripWorkspaceConfig
): number {
  const usableWidth = config.viewportWidth - config.outerMarginPx * 2;
  if (column.customWidthRatio !== undefined) {
    const clampedRatio = clamp(column.customWidthRatio, 0.25, 1.0);
    return clamp(Math.round(usableWidth * clampedRatio), 380, usableWidth);
  }

  const ratio = presetToRatio(column.widthPreset);

  if (ratio >= 0.99) {
    return Math.round(usableWidth);
  }
  // Subtract proportional gap so 2x (1/2) or 3x (1/3) columns fit cleanly inside the 1920px viewport
  const gapCompensation =
    column.widthPreset === '1/2'
      ? Math.round(config.columnGapPx / 2)
      : column.widthPreset === '1/3'
      ? Math.round((config.columnGapPx * 2) / 3)
      : Math.round(config.columnGapPx / 2);

  return Math.max(380, Math.round(usableWidth * ratio - gapCompensation));
}

export function computeStripLayout(state: StripWorkspaceState): ComputedStripLayout {
  const { config, columns, windows, focusedWindowId, scrollOffsetPx } = state;
  const usableTopPx = config.topHudHeight + config.outerMarginPx;
  const usableBottomPx = config.viewportHeight - config.bottomDockHeight - config.outerMarginPx;
  const usableWorkHeightPx = Math.max(240, usableBottomPx - usableTopPx);

  const activeColumns = columns.filter((col) =>
    col.windowIds.some((id) => {
      const w = windows[id];
      return w && !w.isMinimized && !w.isPinnedPip;
    })
  );

  let cursorX = config.outerMarginPx;
  const placements: ComputedWindowPlacement[] = [];
  const placementByWindowId: Record<string, ComputedWindowPlacement> = {};
  const groupContainers: ComputedColumnGroupContainer[] = [];

  const groupHeaderAllowancePx = 30;

  activeColumns.forEach((col, colIndex) => {
    const validWindowIds = col.windowIds.filter((id) => {
      const w = windows[id];
      return w && !w.isMinimized && !w.isPinnedPip;
    });

    const colWidth = computeColumnWidthPx(col, config);
    const stripLeft = cursorX;
    const stripRight = stripLeft + colWidth;

    const screenLeft = Math.round(stripLeft - scrollOffsetPx);
    const screenRight = screenLeft + colWidth;

    const stackCount = validWindowIds.length;
    const splitRatio = clamp(col.splitRatio || 0.5, 0.25, 0.75);
    const colHeightRatio = clamp(col.customHeightRatio ?? 1.0, 0.35, 1.0);
    const colBottomPx = Math.round(
      usableTopPx + usableWorkHeightPx * colHeightRatio
    );

    const innerTopPx =
      stackCount > 1 ? usableTopPx + groupHeaderAllowancePx : usableTopPx;
    const innerWorkHeightPx = Math.max(200, colBottomPx - innerTopPx);
    let computedDividerY = Math.round(innerTopPx + innerWorkHeightPx * splitRatio);

    validWindowIds.forEach((winId, stackIndex) => {
      let winTop = innerTopPx;
      let winBottom = colBottomPx;

      if (stackCount === 2) {
        const firstHeight = Math.round(
          (innerWorkHeightPx - config.stackGapPx) * splitRatio
        );
        computedDividerY = innerTopPx + firstHeight + Math.round(config.stackGapPx / 2);
        if (stackIndex === 0) {
          winTop = innerTopPx;
          winBottom = innerTopPx + firstHeight;
        } else {
          winTop = innerTopPx + firstHeight + config.stackGapPx;
          winBottom = colBottomPx;
        }
      } else if (stackCount > 2) {
        const eachHeight = Math.round(
          (innerWorkHeightPx - config.stackGapPx * (stackCount - 1)) / stackCount
        );
        winTop = innerTopPx + stackIndex * (eachHeight + config.stackGapPx);
        winBottom = stackIndex === stackCount - 1 ? colBottomPx : winTop + eachHeight;
      }

      const stripRect: AndroidRect = {
        left: stripLeft,
        top: winTop,
        right: stripRight,
        bottom: winBottom,
      };

      const screenRect: AndroidRect = {
        left: screenLeft,
        top: winTop,
        right: screenRight,
        bottom: winBottom,
      };

      // Calculate intersection with the physical 1920px viewport
      const visibleLeft = clamp(screenLeft, 0, config.viewportWidth);
      const visibleRight = clamp(screenRight, 0, config.viewportWidth);
      const visibleWidth = Math.max(0, visibleRight - visibleLeft);
      const visibleRatio = colWidth > 0 ? Number((visibleWidth / colWidth).toFixed(3)) : 0;

      let visibilityState: WindowVisibilityState = 'offscreen_parked';
      if (visibleRatio >= 0.96) {
        visibilityState = 'fully_visible';
      } else if (visibleWidth >= 96) {
        visibilityState = 'partially_visible';
      }

      // Compute the real Android Freeform Rect applied to Samsung DeX WindowManager
      // When standard_launch_bounds is used, One UI clamps off-screen windows unless we clamp or stash them cleanly.
      let dexAppliedRect: AndroidRect;
      if (visibilityState === 'offscreen_parked') {
        // Parked safely at an edge peek slot or stashed when off-screen
        const parkedEdgeLeft =
          screenLeft < 0 ? -colWidth + 24 : config.viewportWidth - 24;
        dexAppliedRect = {
          left: parkedEdgeLeft,
          top: winTop,
          right: parkedEdgeLeft + colWidth,
          bottom: winBottom,
        };
      } else if (config.executionBackend === 'standard_launch_bounds') {
        // Clamped within DeX valid launch bounds [0..viewportWidth] with min 360px width
        const clampedLeft = clamp(screenLeft, 0, config.viewportWidth - 360);
        const clampedRight = clamp(screenRight, clampedLeft + 360, config.viewportWidth);
        dexAppliedRect = {
          left: clampedLeft,
          top: winTop,
          right: clampedRight,
          bottom: winBottom,
        };
      } else {
        // Shizuku IActivityTaskManager.resizeTask allows smooth negative/overflow coordinates during strip scroll
        dexAppliedRect = { ...screenRect };
      }

      const placement: ComputedWindowPlacement = {
        windowId: winId,
        columnId: col.id,
        columnIndex: colIndex,
        stackIndex,
        stackCount,
        stripRect,
        screenRect,
        dexAppliedRect,
        visibilityState,
        visibleRatio,
        isFocused: focusedWindowId === winId,
      };

      placements.push(placement);
      placementByWindowId[winId] = placement;
    });

    if (stackCount > 1) {
      const totalMemoryMb = validWindowIds.reduce(
        (sum, id) => sum + (windows[id]?.memoryMb ?? 0),
        0
      );
      groupContainers.push({
        groupId: `grp-${col.id}`,
        columnId: col.id,
        columnIndex: colIndex,
        windowIds: validWindowIds,
        widthPreset: col.widthPreset,
        splitRatio,
        stripContainerRect: {
          left: stripLeft - 6,
          top: usableTopPx - 4,
          right: stripRight + 6,
          bottom: colBottomPx + 6,
        },
        screenContainerRect: {
          left: screenLeft - 6,
          top: usableTopPx - 4,
          right: screenRight + 6,
          bottom: colBottomPx + 6,
        },
        dividerScreenY: computedDividerY,
        isFocusedGroup: validWindowIds.includes(focusedWindowId ?? ''),
        totalMemoryMb,
      });
    }

    cursorX = stripRight + config.columnGapPx;
  });

  const totalStripWidthPx =
    activeColumns.length > 0
      ? cursorX - config.columnGapPx + config.outerMarginPx
      : config.viewportWidth;

  const maxScrollOffsetPx = Math.max(0, totalStripWidthPx - config.viewportWidth);

  const visibleWindowCount = placements.filter(
    (p) => p.visibilityState !== 'offscreen_parked'
  ).length;
  const offscreenWindowCount = placements.filter(
    (p) => p.visibilityState === 'offscreen_parked'
  ).length;

  // Ultra-low resource footprint calculation for the Compose Overlay + AccessibilityService
  const estimatedOverlayRamMb = Number(
    (11.4 + placements.length * 0.35 + (config.executionBackend === 'shizuku_binder' ? 1.2 : 0.4)).toFixed(1)
  );

  return {
    totalStripWidthPx,
    maxScrollOffsetPx,
    usableWorkHeightPx,
    usableTopPx,
    usableBottomPx,
    placements,
    placementByWindowId,
    groupContainers,
    visibleWindowCount,
    offscreenWindowCount,
    estimatedOverlayRamMb,
  };
}

export function computeScrollToFocusWindow(
  state: StripWorkspaceState,
  targetWindowId: string,
  overrideMode?: ScrollFocusMode
): number {
  const layout = computeStripLayout(state);
  const placement = layout.placementByWindowId[targetWindowId];
  if (!placement) {
    return clamp(state.scrollOffsetPx, 0, layout.maxScrollOffsetPx);
  }

  const mode = overrideMode ?? state.config.scrollFocusMode;
  const { left, right } = placement.stripRect;
  const colWidth = right - left;
  const { viewportWidth, outerMarginPx } = state.config;

  if (mode === 'center') {
    const colCenter = left + colWidth / 2;
    const desiredScroll = Math.round(colCenter - viewportWidth / 2);
    return clamp(desiredScroll, 0, layout.maxScrollOffsetPx);
  }

  // 'edge_snap': Only scroll if the column is outside [outerMarginPx, viewportWidth - outerMarginPx]
  const currentScreenLeft = left - state.scrollOffsetPx;
  const currentScreenRight = right - state.scrollOffsetPx;

  if (currentScreenLeft < outerMarginPx) {
    return clamp(left - outerMarginPx, 0, layout.maxScrollOffsetPx);
  }
  if (currentScreenRight > viewportWidth - outerMarginPx) {
    return clamp(
      right - (viewportWidth - outerMarginPx),
      0,
      layout.maxScrollOffsetPx
    );
  }

  return clamp(state.scrollOffsetPx, 0, layout.maxScrollOffsetPx);
}

export function focusWindowAndScroll(
  state: StripWorkspaceState,
  targetWindowId: string
): StripWorkspaceState {
  const targetWin = state.windows[targetWindowId];
  if (!targetWin) return state;

  // If window was minimized, unminimize it first
  const updatedWindows = {
    ...state.windows,
    [targetWindowId]: {
      ...targetWin,
      isMinimized: false,
      lastFocusedAt: Date.now(),
    },
  };

  // Ensure window is in a column if it wasn't
  const inAnyCol = state.columns.some((c) => c.windowIds.includes(targetWindowId));
  const updatedColumns = inAnyCol
    ? state.columns
    : [
        ...state.columns,
        {
          id: `col-${targetWindowId}`,
          widthPreset: '1/2' as WidthPreset,
          windowIds: [targetWindowId],
          splitRatio: 0.5,
        },
      ];

  const intermediateState: StripWorkspaceState = {
    ...state,
    windows: updatedWindows,
    columns: updatedColumns,
    focusedWindowId: targetWindowId,
  };

  const nextScroll = computeScrollToFocusWindow(intermediateState, targetWindowId);
  return {
    ...intermediateState,
    scrollOffsetPx: nextScroll,
  };
}

export function cycleFocusHorizontal(
  state: StripWorkspaceState,
  direction: -1 | 1
): StripWorkspaceState {
  const layout = computeStripLayout(state);
  if (layout.placements.length === 0) return state;

  const currentIdx = layout.placements.findIndex(
    (p) => p.windowId === state.focusedWindowId
  );
  const nextIdx =
    currentIdx === -1
      ? 0
      : (currentIdx + direction + layout.placements.length) %
        layout.placements.length;

  const nextWindowId = layout.placements[nextIdx].windowId;
  return focusWindowAndScroll(state, nextWindowId);
}

export function moveActiveColumnInStrip(
  state: StripWorkspaceState,
  direction: -1 | 1
): StripWorkspaceState {
  if (!state.focusedWindowId) return state;
  const colIdx = state.columns.findIndex((c) =>
    c.windowIds.includes(state.focusedWindowId!)
  );
  if (colIdx === -1) return state;

  const targetIdx = colIdx + direction;
  if (targetIdx < 0 || targetIdx >= state.columns.length) return state;

  const nextColumns = [...state.columns];
  const [moved] = nextColumns.splice(colIdx, 1);
  nextColumns.splice(targetIdx, 0, moved);

  const updatedState: StripWorkspaceState = {
    ...state,
    columns: nextColumns,
  };

  return {
    ...updatedState,
    scrollOffsetPx: computeScrollToFocusWindow(
      updatedState,
      state.focusedWindowId
    ),
  };
}

export function setColumnWidthPreset(
  state: StripWorkspaceState,
  columnId: string,
  preset: WidthPreset
): StripWorkspaceState {
  const nextColumns = state.columns.map((col) =>
    col.id === columnId
      ? {
          ...col,
          widthPreset: preset,
          customWidthRatio: undefined,
          customHeightRatio:
            preset === 'full' ? undefined : col.customHeightRatio,
        }
      : col
  );

  const nextState: StripWorkspaceState = {
    ...state,
    columns: nextColumns,
  };

  if (state.focusedWindowId) {
    return {
      ...nextState,
      scrollOffsetPx: computeScrollToFocusWindow(
        nextState,
        state.focusedWindowId
      ),
    };
  }
  return nextState;
}

export function cycleActiveColumnWidth(
  state: StripWorkspaceState
): StripWorkspaceState {
  if (!state.focusedWindowId) return state;
  const col = state.columns.find((c) =>
    c.windowIds.includes(state.focusedWindowId!)
  );
  if (!col) return state;

  const nextPreset = getNextWidthPreset(col.widthPreset);
  return setColumnWidthPreset(state, col.id, nextPreset);
}

export function toggleStackWindowWithNeighbor(
  state: StripWorkspaceState,
  windowId: string
): StripWorkspaceState {
  const colIdx = state.columns.findIndex((c) => c.windowIds.includes(windowId));
  if (colIdx === -1) return state;

  const currentCol = state.columns[colIdx];

  // Case 1: Already stacked (2+ windows in this column) -> Unstack into two adjacent columns
  if (currentCol.windowIds.length > 1) {
    const remainingIds = currentCol.windowIds.filter((id) => id !== windowId);
    const updatedCol: StripColumn = {
      ...currentCol,
      windowIds: remainingIds,
    };
    const newIndividualCol: StripColumn = {
      id: `col-${windowId}-${Date.now()}`,
      widthPreset: currentCol.widthPreset,
      windowIds: [windowId],
      splitRatio: 0.5,
    };

    const nextColumns = [...state.columns];
    nextColumns.splice(colIdx, 1, updatedCol, newIndividualCol);

    const nextState: StripWorkspaceState = {
      ...state,
      columns: nextColumns,
      focusedWindowId: windowId,
    };
    return {
      ...nextState,
      scrollOffsetPx: computeScrollToFocusWindow(nextState, windowId),
    };
  }

  // Case 2: Single window in column -> Stack with right neighbor (or left neighbor if last)
  const neighborIdx =
    colIdx + 1 < state.columns.length ? colIdx + 1 : colIdx - 1;
  if (neighborIdx < 0 || neighborIdx >= state.columns.length) return state;

  const neighborCol = state.columns[neighborIdx];
  if (neighborCol.windowIds.length >= 2) {
    // Try the other neighbor if this one already has 2 windows
    const altIdx = neighborIdx === colIdx + 1 ? colIdx - 1 : colIdx + 1;
    if (
      altIdx < 0 ||
      altIdx >= state.columns.length ||
      state.columns[altIdx].windowIds.length >= 2
    ) {
      return state;
    }
    const altNeighbor = state.columns[altIdx];
    const mergedCol: StripColumn = {
      ...altNeighbor,
      windowIds: [...altNeighbor.windowIds, windowId],
      splitRatio: 0.5,
    };
    const nextColumns = state.columns
      .map((c, idx) => (idx === altIdx ? mergedCol : c))
      .filter((_, idx) => idx !== colIdx);

    const nextState: StripWorkspaceState = {
      ...state,
      columns: nextColumns,
      focusedWindowId: windowId,
    };
    return {
      ...nextState,
      scrollOffsetPx: computeScrollToFocusWindow(nextState, windowId),
    };
  }

  const mergedCol: StripColumn = {
    ...neighborCol,
    windowIds:
      neighborIdx > colIdx
        ? [windowId, ...neighborCol.windowIds]
        : [...neighborCol.windowIds, windowId],
    splitRatio: 0.5,
  };

  const nextColumns = state.columns
    .map((c, idx) => (idx === neighborIdx ? mergedCol : c))
    .filter((_, idx) => idx !== colIdx);

  const nextState: StripWorkspaceState = {
    ...state,
    columns: nextColumns,
    focusedWindowId: windowId,
  };
  return {
    ...nextState,
    scrollOffsetPx: computeScrollToFocusWindow(nextState, windowId),
  };
}

export type SnapZoneType = 'stack_top' | 'stack_bottom' | 'snap_left' | 'snap_right';

export interface SnapDropTarget {
  draggedWindowId: string;
  targetColumnId: string;
  targetWindowId: string;
  zone: SnapZoneType;
  previewScreenRect: AndroidRect;
  previewStripRect: AndroidRect;
  label: string;
}

export function computeSnapDropTarget(
  state: StripWorkspaceState,
  layout: ComputedStripLayout,
  draggedWindowId: string,
  pointerScreenX: number,
  pointerScreenY: number
): SnapDropTarget | null {
  const draggedPlacement = layout.placementByWindowId[draggedWindowId];
  if (!draggedPlacement) return null;

  const pointerStripX = pointerScreenX + state.scrollOffsetPx;
  const usableTop = layout.usableTopPx;
  const usableBottom = layout.usableBottomPx;
  const midY = Math.round((usableTop + usableBottom) / 2);

  // Group placements by columnId
  const columnMap = new Map<
    string,
    {
      columnId: string;
      stripLeft: number;
      stripRight: number;
      screenLeft: number;
      screenRight: number;
      windowIds: string[];
    }
  >();

  for (const p of layout.placements) {
    if (!columnMap.has(p.columnId)) {
      columnMap.set(p.columnId, {
        columnId: p.columnId,
        stripLeft: p.stripRect.left,
        stripRight: p.stripRect.right,
        screenLeft: p.screenRect.left,
        screenRight: p.screenRect.right,
        windowIds: [p.windowId],
      });
    } else {
      columnMap.get(p.columnId)!.windowIds.push(p.windowId);
    }
  }

  const edgeThresholdPx = 110;

  for (const colInfo of columnMap.values()) {
    const isSameSingleColumn =
      colInfo.columnId === draggedPlacement.columnId &&
      colInfo.windowIds.length === 1;

    // Check if pointer X is within or right beside this column
    if (
      pointerStripX < colInfo.stripLeft - 28 ||
      pointerStripX > colInfo.stripRight + 28
    ) {
      continue;
    }

    const primaryTargetWinId =
      colInfo.windowIds.find((id) => id !== draggedWindowId) ||
      colInfo.windowIds[0];
    const targetWinTitle =
      state.windows[primaryTargetWinId]?.title.split(' ')[0] ||
      primaryTargetWinId;

    // If hovering on the same column when it is already stacked (2 windows),
    // allow unstacking to left/right edge or swapping top/bottom!
    if (colInfo.columnId === draggedPlacement.columnId) {
      if (colInfo.windowIds.length > 1) {
        if (pointerStripX <= colInfo.stripLeft + edgeThresholdPx) {
          return {
            draggedWindowId,
            targetColumnId: colInfo.columnId,
            targetWindowId: primaryTargetWinId,
            zone: 'snap_left',
            previewScreenRect: {
              left: colInfo.screenLeft,
              top: usableTop,
              right: colInfo.screenLeft + Math.round((colInfo.screenRight - colInfo.screenLeft) * 0.45),
              bottom: usableBottom,
            },
            previewStripRect: {
              left: colInfo.stripLeft,
              top: usableTop,
              right: colInfo.stripLeft + Math.round((colInfo.stripRight - colInfo.stripLeft) * 0.45),
              bottom: usableBottom,
            },
            label: `Gruptan Ayır → Sol Bağımsız Sütun`,
          };
        }
        if (pointerStripX >= colInfo.stripRight - edgeThresholdPx) {
          return {
            draggedWindowId,
            targetColumnId: colInfo.columnId,
            targetWindowId: primaryTargetWinId,
            zone: 'snap_right',
            previewScreenRect: {
              left: colInfo.screenRight - Math.round((colInfo.screenRight - colInfo.screenLeft) * 0.45),
              top: usableTop,
              right: colInfo.screenRight,
              bottom: usableBottom,
            },
            previewStripRect: {
              left: colInfo.stripRight - Math.round((colInfo.stripRight - colInfo.stripLeft) * 0.45),
              top: usableTop,
              right: colInfo.stripRight,
              bottom: usableBottom,
            },
            label: `Gruptan Ayır → Sağ Bağımsız Sütun`,
          };
        }
      }
      if (isSameSingleColumn) {
        continue;
      }
    }

    // Left Edge Snap (Snap as Standalone Column Before Target)
    if (pointerStripX <= colInfo.stripLeft + edgeThresholdPx) {
      const previewWidth = Math.min(260, Math.round((colInfo.screenRight - colInfo.screenLeft) * 0.4));
      return {
        draggedWindowId,
        targetColumnId: colInfo.columnId,
        targetWindowId: primaryTargetWinId,
        zone: 'snap_left',
        previewScreenRect: {
          left: colInfo.screenLeft,
          top: usableTop,
          right: colInfo.screenLeft + previewWidth,
          bottom: usableBottom,
        },
        previewStripRect: {
          left: colInfo.stripLeft,
          top: usableTop,
          right: colInfo.stripLeft + previewWidth,
          bottom: usableBottom,
        },
        label: `${targetWinTitle} Soluna Yapıştır (Yeni Sütun)`,
      };
    }

    // Right Edge Snap (Snap as Standalone Column After Target)
    if (pointerStripX >= colInfo.stripRight - edgeThresholdPx) {
      const previewWidth = Math.min(260, Math.round((colInfo.screenRight - colInfo.screenLeft) * 0.4));
      return {
        draggedWindowId,
        targetColumnId: colInfo.columnId,
        targetWindowId: primaryTargetWinId,
        zone: 'snap_right',
        previewScreenRect: {
          left: colInfo.screenRight - previewWidth,
          top: usableTop,
          right: colInfo.screenRight,
          bottom: usableBottom,
        },
        previewStripRect: {
          left: colInfo.stripRight - previewWidth,
          top: usableTop,
          right: colInfo.stripRight,
          bottom: usableBottom,
        },
        label: `${targetWinTitle} Sağına Yapıştır (Yeni Sütun)`,
      };
    }

    // Center Magnetic Snap-to-Group (Vertical Top / Bottom Split Group)
    if (pointerScreenY < midY) {
      return {
        draggedWindowId,
        targetColumnId: colInfo.columnId,
        targetWindowId: primaryTargetWinId,
        zone: 'stack_top',
        previewScreenRect: {
          left: colInfo.screenLeft,
          top: usableTop,
          right: colInfo.screenRight,
          bottom: midY - Math.round(state.config.stackGapPx / 2),
        },
        previewStripRect: {
          left: colInfo.stripLeft,
          top: usableTop,
          right: colInfo.stripRight,
          bottom: midY - Math.round(state.config.stackGapPx / 2),
        },
        label: `${targetWinTitle} ile Grupla (Üst Yarıya Yapıştır)`,
      };
    } else {
      return {
        draggedWindowId,
        targetColumnId: colInfo.columnId,
        targetWindowId: primaryTargetWinId,
        zone: 'stack_bottom',
        previewScreenRect: {
          left: colInfo.screenLeft,
          top: midY + Math.round(state.config.stackGapPx / 2),
          right: colInfo.screenRight,
          bottom: usableBottom,
        },
        previewStripRect: {
          left: colInfo.stripLeft,
          top: midY + Math.round(state.config.stackGapPx / 2),
          right: colInfo.stripRight,
          bottom: usableBottom,
        },
        label: `${targetWinTitle} ile Grupla (Alt Yarıya Yapıştır)`,
      };
    }
  }

  return null;
}

export function applySnapDropAction(
  state: StripWorkspaceState,
  target: SnapDropTarget
): StripWorkspaceState {
  const { draggedWindowId, targetColumnId, zone } = target;
  if (!state.windows[draggedWindowId]) return state;

  const sourceCol = state.columns.find((c) =>
    c.windowIds.includes(draggedWindowId)
  );
  const sourcePreset: WidthPreset = sourceCol?.widthPreset ?? '1/2';

  // Step 1: If dropping onto the SAME column to unstack (snap_left or snap_right)
  if (sourceCol && sourceCol.id === targetColumnId && sourceCol.windowIds.length > 1) {
    const remainingIds = sourceCol.windowIds.filter((id) => id !== draggedWindowId);
    const updatedSourceCol: StripColumn = {
      ...sourceCol,
      windowIds: remainingIds,
    };
    const newStandaloneCol: StripColumn = {
      id: `col-${draggedWindowId}-${Date.now()}`,
      widthPreset: sourcePreset,
      windowIds: [draggedWindowId],
      splitRatio: 0.5,
    };

    const nextColumns: StripColumn[] = [];
    for (const col of state.columns) {
      if (col.id === sourceCol.id) {
        if (zone === 'snap_left') {
          nextColumns.push(newStandaloneCol, updatedSourceCol);
        } else if (zone === 'snap_right') {
          nextColumns.push(updatedSourceCol, newStandaloneCol);
        } else if (zone === 'stack_top') {
          nextColumns.push({
            ...sourceCol,
            windowIds: [draggedWindowId, ...remainingIds],
          });
        } else {
          nextColumns.push({
            ...sourceCol,
            windowIds: [...remainingIds, draggedWindowId],
          });
        }
      } else {
        nextColumns.push(col);
      }
    }

    const nextState: StripWorkspaceState = {
      ...state,
      columns: nextColumns,
      focusedWindowId: draggedWindowId,
    };
    return {
      ...nextState,
      scrollOffsetPx: computeScrollToFocusWindow(nextState, draggedWindowId),
    };
  }

  // Step 2: Remove draggedWindowId from its original column
  const strippedColumns = state.columns
    .map((c) => ({
      ...c,
      windowIds: c.windowIds.filter((id) => id !== draggedWindowId),
    }))
    .filter((c) => c.windowIds.length > 0);

  const targetIdx = strippedColumns.findIndex((c) => c.id === targetColumnId);
  if (targetIdx === -1) return state;

  const targetCol = strippedColumns[targetIdx];
  const nextColumns = [...strippedColumns];

  if (zone === 'snap_left') {
    const newCol: StripColumn = {
      id: `col-${draggedWindowId}-${Date.now()}`,
      widthPreset: sourcePreset,
      windowIds: [draggedWindowId],
      splitRatio: 0.5,
    };
    nextColumns.splice(targetIdx, 0, newCol);
  } else if (zone === 'snap_right') {
    const newCol: StripColumn = {
      id: `col-${draggedWindowId}-${Date.now()}`,
      widthPreset: sourcePreset,
      windowIds: [draggedWindowId],
      splitRatio: 0.5,
    };
    nextColumns.splice(targetIdx + 1, 0, newCol);
  } else if (zone === 'stack_top') {
    if (targetCol.windowIds.length >= 2) {
      // Displace the bottom window into an adjacent standalone column so max stack stays 2
      const keptId = targetCol.windowIds[0];
      const displacedIds = targetCol.windowIds.slice(1);
      const updatedTargetCol: StripColumn = {
        ...targetCol,
        windowIds: [draggedWindowId, keptId],
        splitRatio: 0.5,
      };
      const displacedCol: StripColumn = {
        id: `col-displaced-${Date.now()}`,
        widthPreset: targetCol.widthPreset,
        windowIds: displacedIds,
        splitRatio: 0.5,
      };
      nextColumns.splice(targetIdx, 1, updatedTargetCol, displacedCol);
    } else {
      nextColumns[targetIdx] = {
        ...targetCol,
        windowIds: [draggedWindowId, ...targetCol.windowIds],
        splitRatio: 0.5,
      };
    }
  } else if (zone === 'stack_bottom') {
    if (targetCol.windowIds.length >= 2) {
      const keptId = targetCol.windowIds[0];
      const displacedIds = targetCol.windowIds.slice(1);
      const updatedTargetCol: StripColumn = {
        ...targetCol,
        windowIds: [keptId, draggedWindowId],
        splitRatio: 0.5,
      };
      const displacedCol: StripColumn = {
        id: `col-displaced-${Date.now()}`,
        widthPreset: targetCol.widthPreset,
        windowIds: displacedIds,
        splitRatio: 0.5,
      };
      nextColumns.splice(targetIdx, 1, updatedTargetCol, displacedCol);
    } else {
      nextColumns[targetIdx] = {
        ...targetCol,
        windowIds: [...targetCol.windowIds, draggedWindowId],
        splitRatio: 0.5,
      };
    }
  }

  const nextState: StripWorkspaceState = {
    ...state,
    columns: nextColumns,
    focusedWindowId: draggedWindowId,
  };

  return {
    ...nextState,
    scrollOffsetPx: computeScrollToFocusWindow(nextState, draggedWindowId),
  };
}

export function swapGroupStackOrder(
  state: StripWorkspaceState,
  columnId: string
): StripWorkspaceState {
  const nextColumns = state.columns.map((col) => {
    if (col.id !== columnId || col.windowIds.length < 2) return col;
    return {
      ...col,
      windowIds: [...col.windowIds].reverse(),
    };
  });
  return {
    ...state,
    columns: nextColumns,
  };
}

export function setColumnSplitRatio(
  state: StripWorkspaceState,
  columnId: string,
  splitRatio: number
): StripWorkspaceState {
  const clamped = clamp(Number(splitRatio.toFixed(2)), 0.3, 0.7);
  const nextColumns = state.columns.map((col) =>
    col.id === columnId ? { ...col, splitRatio: clamped } : col
  );
  return {
    ...state,
    columns: nextColumns,
  };
}

export function unstackEntireGroup(
  state: StripWorkspaceState,
  columnId: string
): StripWorkspaceState {
  const idx = state.columns.findIndex((c) => c.id === columnId);
  if (idx === -1) return state;

  const targetCol = state.columns[idx];
  if (targetCol.windowIds.length <= 1) return state;

  const expandedCols: StripColumn[] = targetCol.windowIds.map((winId, i) => ({
    id: i === 0 ? targetCol.id : `col-${winId}-${Date.now()}-${i}`,
    widthPreset: targetCol.widthPreset,
    windowIds: [winId],
    splitRatio: 0.5,
  }));

  const nextColumns = [...state.columns];
  nextColumns.splice(idx, 1, ...expandedCols);

  const focusedId = state.focusedWindowId ?? targetCol.windowIds[0];
  const nextState: StripWorkspaceState = {
    ...state,
    columns: nextColumns,
    focusedWindowId: focusedId,
  };

  return {
    ...nextState,
    scrollOffsetPx: computeScrollToFocusWindow(nextState, focusedId),
  };
}

export function toggleWindowFullscreen(
  state: StripWorkspaceState,
  windowId: string
): StripWorkspaceState {
  const colIdx = state.columns.findIndex((c) => c.windowIds.includes(windowId));
  if (colIdx === -1) return state;

  const targetCol = state.columns[colIdx];

  // If the window is stacked in a multi-window group, extract it into its own full-width column
  if (targetCol.windowIds.length > 1) {
    const remainingIds = targetCol.windowIds.filter((id) => id !== windowId);
    const updatedGroupCol: StripColumn = {
      ...targetCol,
      windowIds: remainingIds,
    };
    const fullscreenCol: StripColumn = {
      id: `col-${windowId}-full-${Date.now()}`,
      widthPreset: 'full',
      windowIds: [windowId],
      splitRatio: 0.5,
    };

    const nextColumns = [...state.columns];
    nextColumns.splice(colIdx, 1, fullscreenCol, updatedGroupCol);

    const nextState: StripWorkspaceState = {
      ...state,
      columns: nextColumns,
      focusedWindowId: windowId,
      windows: {
        ...state.windows,
        [windowId]: {
          ...state.windows[windowId],
          isMinimized: false,
          isPinnedPip: false,
          lastFocusedAt: Date.now(),
        },
      },
    };

    return {
      ...nextState,
      scrollOffsetPx: computeScrollToFocusWindow(nextState, windowId),
    };
  }

  // Otherwise toggle between 'full' and '1/2' preset on its column and focus/scroll to it
  const nextPreset: WidthPreset =
    targetCol.widthPreset === 'full' && !targetCol.customWidthRatio && !targetCol.customHeightRatio
      ? '1/2'
      : 'full';

  const focusedState = focusWindowAndScroll(state, windowId);
  const updatedState = setColumnWidthPreset(focusedState, targetCol.id, nextPreset);
  return {
    ...updatedState,
    columns: updatedState.columns.map((col) =>
      col.id === targetCol.id
        ? { ...col, customWidthRatio: undefined, customHeightRatio: undefined }
        : col
    ),
  };
}

export interface WindowResizeParams {
  windowId: string;
  newWidthPx: number;
  newHeightPx: number;
  viewportWorkHeightPx?: number;
}

export function inferClosestWidthPreset(ratio: number): WidthPreset {
  const candidates: { preset: WidthPreset; val: number }[] = [
    { preset: '1/3', val: 0.3333 },
    { preset: '1/2', val: 0.5 },
    { preset: '2/3', val: 0.6667 },
    { preset: 'full', val: 1.0 },
  ];
  let best = candidates[0];
  let minDiff = Math.abs(ratio - best.val);
  for (const c of candidates) {
    const d = Math.abs(ratio - c.val);
    if (d < minDiff) {
      minDiff = d;
      best = c;
    }
  }
  return best.preset;
}

export function resizeWindowInStrip(
  state: StripWorkspaceState,
  params: WindowResizeParams
): StripWorkspaceState {
  const { windowId, newWidthPx, newHeightPx, viewportWorkHeightPx } = params;
  const colIdx = state.columns.findIndex((c) => c.windowIds.includes(windowId));
  if (colIdx === -1) return state;

  const usableWidth =
    state.config.viewportWidth - state.config.outerMarginPx * 2;
  const usableTopPx = state.config.topHudHeight + state.config.outerMarginPx;
  const defaultUsableBottomPx =
    state.config.viewportHeight -
    state.config.bottomDockHeight -
    state.config.outerMarginPx;
  const maxWorkHeightPx = Math.max(
    240,
    viewportWorkHeightPx ?? defaultUsableBottomPx - usableTopPx
  );

  const clampedWidthPx = clamp(Math.round(newWidthPx), 380, usableWidth);
  const customWidthRatio = Number(
    clamp(clampedWidthPx / usableWidth, 0.25, 1.0).toFixed(4)
  );
  const closestPreset = inferClosestWidthPreset(customWidthRatio);

  const targetCol = state.columns[colIdx];
  const validWinIds = targetCol.windowIds.filter((id) => {
    const w = state.windows[id];
    return w && !w.isMinimized && !w.isPinnedPip;
  });
  const stackCount = validWinIds.length;
  const stackIndex = validWinIds.indexOf(windowId);

  let nextSplitRatio = targetCol.splitRatio || 0.5;
  let nextCustomHeightRatio = targetCol.customHeightRatio;

  if (stackCount === 2 && stackIndex === 0) {
    // Dragging the bottom-right handle of the top stacked window adjusts vertical splitRatio AND column width
    const colHeightRatio = clamp(targetCol.customHeightRatio ?? 1.0, 0.45, 1.0);
    const groupInnerHeight = Math.max(
      200,
      Math.round(maxWorkHeightPx * colHeightRatio) - 30 - state.config.stackGapPx
    );
    nextSplitRatio = clamp(
      Number((newHeightPx / groupInnerHeight).toFixed(3)),
      0.25,
      0.75
    );
  } else if (stackCount >= 2 && stackIndex === stackCount - 1) {
    // Dragging the bottom-right handle of the bottom stacked window adjusts overall column height ratio
    const currentSplit = clamp(targetCol.splitRatio || 0.5, 0.25, 0.75);
    const bottomShare = Math.max(0.25, 1 - currentSplit);
    const estimatedTotalInnerHeight =
      newHeightPx / bottomShare + 30 + state.config.stackGapPx;
    nextCustomHeightRatio = Number(
      clamp(estimatedTotalInnerHeight / maxWorkHeightPx, 0.45, 1.0).toFixed(4)
    );
  } else {
    // Standalone window: height maps directly to customHeightRatio
    nextCustomHeightRatio = Number(
      clamp(newHeightPx / maxWorkHeightPx, 0.35, 1.0).toFixed(4)
    );
  }

  const nextColumns = state.columns.map((col, idx) =>
    idx === colIdx
      ? {
          ...col,
          widthPreset: closestPreset,
          customWidthRatio,
          customHeightRatio: nextCustomHeightRatio,
          splitRatio: nextSplitRatio,
        }
      : col
  );

  const nextState: StripWorkspaceState = {
    ...state,
    columns: nextColumns,
    focusedWindowId: windowId,
  };

  const nextLayout = computeStripLayout(nextState);
  return {
    ...nextState,
    scrollOffsetPx: clamp(
      nextState.scrollOffsetPx,
      0,
      nextLayout.maxScrollOffsetPx
    ),
  };
}

export type SpringPresetId = 'dex_90hz_balanced' | 'elastic_bouncy' | 'snappy_pro';

export interface SpringPhysicsConfig {
  id: SpringPresetId;
  label: string;
  stiffness: number; // k
  damping: number; // c
  mass: number; // m
}

export interface ComputedSpringCurve {
  presetId: SpringPresetId;
  stiffness: number;
  damping: number;
  mass: number;
  dampingRatio: number;
  durationMs: number;
  activeFollowDurationMs: number;
  peakOvershootPct: number;
  easingCss: string;
  transitionCss: string;
  activeDragTransitionCss: string;
  activeResizeTransitionCss: string;
}

export const SPRING_PRESETS: Record<SpringPresetId, SpringPhysicsConfig> = {
  dex_90hz_balanced: {
    id: 'dex_90hz_balanced',
    label: '90Hz Dengeli Yay (k=380, c=26)',
    stiffness: 380,
    damping: 26,
    mass: 0.8,
  },
  elastic_bouncy: {
    id: 'elastic_bouncy',
    label: 'Elastik Yay (k=420, c=19)',
    stiffness: 420,
    damping: 19,
    mass: 0.85,
  },
  snappy_pro: {
    id: 'snappy_pro',
    label: 'Hızlı Tepki (k=580, c=36)',
    stiffness: 580,
    damping: 36,
    mass: 0.7,
  },
};

export function solveSpringPositionAtTime(
  tSec: number,
  stiffness: number,
  damping: number,
  mass: number
): number {
  if (tSec <= 0) return 0;
  const omega0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));

  if (zeta < 1) {
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
    const envelope = Math.exp(-zeta * omega0 * tSec);
    const osc =
      Math.cos(omegaD * tSec) +
      ((zeta * omega0) / omegaD) * Math.sin(omegaD * tSec);
    return 1 - envelope * osc;
  } else {
    const envelope = Math.exp(-omega0 * tSec);
    return 1 - (1 + omega0 * tSec) * envelope;
  }
}

export function computeSpringCurve(
  presetId: SpringPresetId = 'dex_90hz_balanced'
): ComputedSpringCurve {
  const cfg = SPRING_PRESETS[presetId] ?? SPRING_PRESETS.dex_90hz_balanced;
  const { stiffness, damping, mass } = cfg;

  const omega0 = Math.sqrt(stiffness / mass);
  const zeta = Number((damping / (2 * Math.sqrt(stiffness * mass))).toFixed(3));

  // Estimate settling time (within 0.2% of target)
  const rawSettleSec = clamp(4.6 / (zeta * omega0), 0.26, 0.62);
  const durationMs = Math.round(rawSettleSec * 1000);
  const activeFollowDurationMs = Math.round(clamp(durationMs * 0.34, 110, 175));

  const sampleCount = 32;
  const samples: number[] = [];
  let maxVal = 1;

  for (let i = 0; i <= sampleCount; i++) {
    const progress = i / sampleCount;
    const tSec = progress * rawSettleSec;
    const pos =
      i === sampleCount
        ? 1
        : Number(solveSpringPositionAtTime(tSec, stiffness, damping, mass).toFixed(4));
    if (pos > maxVal) maxVal = pos;
    samples.push(pos);
  }

  const peakOvershootPct = Number(Math.max(0, (maxVal - 1) * 100).toFixed(1));
  const easingCss = `linear(${samples.join(', ')})`;

  const transitionCss = [
    `transform ${durationMs}ms ${easingCss}`,
    `width ${durationMs}ms ${easingCss}`,
    `height ${durationMs}ms ${easingCss}`,
    `box-shadow 200ms ease-out`,
  ].join(', ');

  const activeDragTransitionCss = [
    `transform ${activeFollowDurationMs}ms ${easingCss}`,
    `width ${durationMs}ms ${easingCss}`,
    `height ${durationMs}ms ${easingCss}`,
    `box-shadow 150ms ease-out`,
  ].join(', ');

  const activeResizeTransitionCss = [
    `transform ${activeFollowDurationMs}ms ${easingCss}`,
    `width ${activeFollowDurationMs}ms ${easingCss}`,
    `height ${activeFollowDurationMs}ms ${easingCss}`,
    `box-shadow 150ms ease-out`,
  ].join(', ');

  return {
    presetId: cfg.id,
    stiffness,
    damping,
    mass,
    dampingRatio: zeta,
    durationMs,
    activeFollowDurationMs,
    peakOvershootPct,
    easingCss,
    transitionCss,
    activeDragTransitionCss,
    activeResizeTransitionCss,
  };
}

export type ThreeFingerGestureMode =
  | 'hybrid_pan_and_fling'
  | 'column_snap_only'
  | 'free_pan_only';

export type ThreeFingerGestureAction =
  | 'fling_prev_column'
  | 'fling_next_column'
  | 'magnetic_column_snap'
  | 'free_pan';

export interface ThreeFingerSwipeResolution {
  nextState: StripWorkspaceState;
  velocityPxPerSec: number;
  isFling: boolean;
  gestureAction: ThreeFingerGestureAction;
  targetWindowId: string | null;
  appliedScrollOffsetPx: number;
}

/**
 * Real-time 90Hz 3-finger horizontal pan delta application.
 * Natural touch direction: moving 3 fingers left (negative deltaX) scrolls the camera right (+scrollOffsetPx).
 */
export function applyThreeFingerPanDelta(
  state: StripWorkspaceState,
  fingerDeltaX: number,
  sensitivity: number = 1.25
): StripWorkspaceState {
  const layout = computeStripLayout(state);
  const cameraDelta = -Math.round(fingerDeltaX * sensitivity);
  const nextScroll = clamp(
    state.scrollOffsetPx + cameraDelta,
    0,
    layout.maxScrollOffsetPx
  );
  return {
    ...state,
    scrollOffsetPx: nextScroll,
  };
}

/**
 * Evaluates a completed 3-finger horizontal swipe/pan gesture:
 * - High velocity fling (|v| >= 520px/s) or column_snap_only mode steps cleanly to the neighbor column.
 * - Slow/medium 3-finger pan in hybrid mode magnetically snaps to the column closest to the viewport center.
 * - free_pan_only preserves the exact continuous scrollOffsetPx.
 */
export function resolveThreeFingerSwipeRelease(
  state: StripWorkspaceState,
  totalFingerDeltaX: number,
  durationMs: number,
  mode: ThreeFingerGestureMode = 'hybrid_pan_and_fling'
): ThreeFingerSwipeResolution {
  const safeDurationMs = Math.max(16, durationMs);
  const velocityPxPerSec = Math.round((totalFingerDeltaX / safeDurationMs) * 1000);
  const layout = computeStripLayout(state);

  if (layout.placements.length === 0) {
    return {
      nextState: state,
      velocityPxPerSec,
      isFling: false,
      gestureAction: 'free_pan',
      targetWindowId: state.focusedWindowId,
      appliedScrollOffsetPx: state.scrollOffsetPx,
    };
  }

  if (mode === 'free_pan_only') {
    return {
      nextState: state,
      velocityPxPerSec,
      isFling: false,
      gestureAction: 'free_pan',
      targetWindowId: state.focusedWindowId,
      appliedScrollOffsetPx: state.scrollOffsetPx,
    };
  }

  const FLING_VELOCITY_THRESHOLD = 520;
  const MIN_SWIPE_DISTANCE_PX = 48;
  const isFling =
    Math.abs(totalFingerDeltaX) >= MIN_SWIPE_DISTANCE_PX &&
    (Math.abs(velocityPxPerSec) >= FLING_VELOCITY_THRESHOLD ||
      mode === 'column_snap_only');

  if (isFling) {
    // Natural touch: swipe fingers LEFT (totalFingerDeltaX < 0) -> go to NEXT column on the right (+1)
    // Swipe fingers RIGHT (totalFingerDeltaX > 0) -> go to PREVIOUS column on the left (-1)
    const direction: -1 | 1 = totalFingerDeltaX < 0 ? 1 : -1;
    const activeColIdx = state.focusedWindowId
      ? state.columns.findIndex((c) => c.windowIds.includes(state.focusedWindowId!))
      : 0;
    const clampedColIdx = clamp(
      (activeColIdx === -1 ? 0 : activeColIdx) + direction,
      0,
      Math.max(0, state.columns.length - 1)
    );
    const targetCol = state.columns[clampedColIdx];
    const targetWinId =
      targetCol?.windowIds.find((id) => {
        const w = state.windows[id];
        return w && !w.isMinimized && !w.isPinnedPip;
      }) ??
      targetCol?.windowIds[0] ??
      state.focusedWindowId;

    const nextState = targetWinId
      ? focusWindowAndScroll(state, targetWinId)
      : cycleFocusHorizontal(state, direction);

    return {
      nextState,
      velocityPxPerSec,
      isFling: true,
      gestureAction:
        direction === 1 ? 'fling_next_column' : 'fling_prev_column',
      targetWindowId: nextState.focusedWindowId,
      appliedScrollOffsetPx: nextState.scrollOffsetPx,
    };
  }

  // Magnetic column snap after continuous 3-finger pan: find column closest to viewport center
  const viewportCenterStripX =
    state.scrollOffsetPx + state.config.viewportWidth / 2;
  let closestPlacement = layout.placements[0];
  let bestDistance = Infinity;

  for (const p of layout.placements) {
    const colCenter = (p.stripRect.left + p.stripRect.right) / 2;
    const dist = Math.abs(colCenter - viewportCenterStripX);
    if (dist < bestDistance) {
      bestDistance = dist;
      closestPlacement = p;
    }
  }

  const snappedState = focusWindowAndScroll(state, closestPlacement.windowId);
  return {
    nextState: snappedState,
    velocityPxPerSec,
    isFling: false,
    gestureAction: 'magnetic_column_snap',
    targetWindowId: snappedState.focusedWindowId,
    appliedScrollOffsetPx: snappedState.scrollOffsetPx,
  };
}






