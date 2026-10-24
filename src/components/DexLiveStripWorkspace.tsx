import React, { useState, useEffect, useRef } from 'react';
import {
  StripWorkspaceState,
  WidthPreset,
  SnapDropTarget,
  SnapZoneType,
  SpringPresetId,
  SPRING_PRESETS,
  computeSpringCurve,
  computeStripLayout,
  computeScrollToFocusWindow,
  focusWindowAndScroll,
  cycleFocusHorizontal,
  moveActiveColumnInStrip,
  setColumnWidthPreset,
  cycleActiveColumnWidth,
  toggleStackWindowWithNeighbor,
  computeSnapDropTarget,
  applySnapDropAction,
  swapGroupStackOrder,
  setColumnSplitRatio,
  unstackEntireGroup,
  toggleWindowFullscreen,
  resizeWindowInStrip,
  clamp,
} from '../engine/stripLayoutEngine';
import { DOCK_APPS, DockLaunchableApp } from '../data/dexSeedWorkspace';
import { DexWindowBody } from './DexWindowBody';
import {
  ChevronLeft,
  ChevronRight,
  Columns,
  Rows,
  Minimize2,
  Maximize2,
  MoreVertical,
  Pin,
  X,
  Search,
  Plus,
  Crosshair,
  GripVertical,
  Magnet,
  Layers,
  ArrowUpDown,
  Ungroup,
} from 'lucide-react';

interface DexLiveStripWorkspaceProps {
  state: StripWorkspaceState;
  setState: React.Dispatch<React.SetStateAction<StripWorkspaceState>>;
  onTriggerExportProject: () => void;
}

interface ActiveWindowDragState {
  windowId: string;
  startClientX: number;
  startClientY: number;
  deltaScreenX: number;
  deltaScreenY: number;
  pointerScreenX: number;
  pointerScreenY: number;
}

interface ActiveWindowResizeState {
  windowId: string;
  startClientX: number;
  startClientY: number;
  initialWidthPx: number;
  initialHeightPx: number;
  currentWidthPx: number;
  currentHeightPx: number;
}

const SPRING_PRESET_ORDER: SpringPresetId[] = [
  'dex_90hz_balanced',
  'elastic_bouncy',
  'snappy_pro',
];

export const DexLiveStripWorkspace: React.FC<DexLiveStripWorkspaceProps> = ({
  state,
  setState,
  onTriggerExportProject,
}) => {
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const [showBoundsHud, setShowBoundsHud] = useState(true);
  const [snapAssistOpen, setSnapAssistOpen] = useState(false);
  const [groupViewOpen, setGroupViewOpen] = useState(false);
  const [highlightGroupContainers, setHighlightGroupContainers] = useState(true);
  const [hoveredSnapPreview, setHoveredSnapPreview] = useState<SnapDropTarget | null>(null);
  const [lastSnapActionLabel, setLastSnapActionLabel] = useState<string | null>(null);
  const [dragState, setDragState] = useState<ActiveWindowDragState | null>(null);
  const [resizeState, setResizeState] = useState<ActiveWindowResizeState | null>(null);
  const [openContextMenuWinId, setOpenContextMenuWinId] = useState<string | null>(null);
  const [springPresetId, setSpringPresetId] = useState<SpringPresetId>('dex_90hz_balanced');

  const springCurve = computeSpringCurve(springPresetId);

  const viewportContainerRef = useRef<HTMLDivElement | null>(null);
  const [viewportScale, setViewportScale] = useState(0.72);
  const effectiveCanvasHeight = 960; // Fits 100% above the fold at 1440x900 when scaled by 0.725 (~696px)

  const effectiveState: StripWorkspaceState = {
    ...state,
    config: {
      ...state.config,
      viewportHeight: effectiveCanvasHeight,
    },
  };

  const layout = computeStripLayout(effectiveState);

  // Compute live magnetic Snap-to-Group target during pointer drag or Snap Assist hover
  const liveDragSnapTarget: SnapDropTarget | null = dragState
    ? computeSnapDropTarget(
        effectiveState,
        layout,
        dragState.windowId,
        dragState.pointerScreenX,
        dragState.pointerScreenY
      )
    : hoveredSnapPreview;

  // Measure available container width so we scale the 1920px Galaxy Tab A11+ WUXGA canvas accurately
  useEffect(() => {
    const updateScale = () => {
      if (!viewportContainerRef.current) return;
      const rect = viewportContainerRef.current.getBoundingClientRect();
      const scaleX = rect.width / state.config.viewportWidth;
      setViewportScale(clamp(scaleX, 0.25, 1.0));
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [state.config.viewportWidth]);

  // Global pointer move / up listeners while dragging a window header
  useEffect(() => {
    if (!dragState) return;

    const handleWindowPointerMove = (e: PointerEvent) => {
      if (!viewportContainerRef.current) return;
      const rect = viewportContainerRef.current.getBoundingClientRect();
      const scale = viewportScale || 0.72;

      const deltaScreenX = Math.round((e.clientX - dragState.startClientX) / scale);
      const deltaScreenY = Math.round((e.clientY - dragState.startClientY) / scale);
      const pointerScreenX = clamp(
        Math.round((e.clientX - rect.left) / scale),
        0,
        state.config.viewportWidth
      );
      const pointerScreenY = clamp(
        Math.round((e.clientY - rect.top) / scale),
        0,
        effectiveCanvasHeight
      );

      setDragState((prev) =>
        prev
          ? {
              ...prev,
              deltaScreenX,
              deltaScreenY,
              pointerScreenX,
              pointerScreenY,
            }
          : null
      );

      // Edge auto-scroll when dragging near left/right viewport boundaries
      if (pointerScreenX < 90) {
        setState((prev) => {
          const l = computeStripLayout(prev);
          return {
            ...prev,
            scrollOffsetPx: clamp(prev.scrollOffsetPx - 18, 0, l.maxScrollOffsetPx),
          };
        });
      } else if (pointerScreenX > state.config.viewportWidth - 90) {
        setState((prev) => {
          const l = computeStripLayout(prev);
          return {
            ...prev,
            scrollOffsetPx: clamp(prev.scrollOffsetPx + 18, 0, l.maxScrollOffsetPx),
          };
        });
      }
    };

    const handleWindowPointerUp = () => {
      if (dragState) {
        const finalTarget = computeSnapDropTarget(
          effectiveState,
          layout,
          dragState.windowId,
          dragState.pointerScreenX,
          dragState.pointerScreenY
        );
        if (finalTarget) {
          setState((prev) => applySnapDropAction(prev, finalTarget));
          setLastSnapActionLabel(finalTarget.label);
        }
      }
      setDragState(null);
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
    };
  }, [dragState, effectiveState, layout, setState, state.config.viewportWidth, viewportScale]);

  // Global pointer move / up listeners while dragging a window's bottom-right resize handle
  useEffect(() => {
    if (!resizeState) return;

    const handleResizePointerMove = (e: PointerEvent) => {
      const scale = viewportScale || 0.72;
      const deltaScreenX = Math.round((e.clientX - resizeState.startClientX) / scale);
      const deltaScreenY = Math.round((e.clientY - resizeState.startClientY) / scale);

      const usableWidth =
        state.config.viewportWidth - state.config.outerMarginPx * 2;
      const nextWidthPx = clamp(
        resizeState.initialWidthPx + deltaScreenX,
        380,
        usableWidth
      );
      const nextHeightPx = clamp(
        resizeState.initialHeightPx + deltaScreenY,
        240,
        layout.usableWorkHeightPx
      );

      setResizeState((prev) =>
        prev
          ? {
              ...prev,
              currentWidthPx: nextWidthPx,
              currentHeightPx: nextHeightPx,
            }
          : null
      );

      setState((prev) =>
        resizeWindowInStrip(prev, {
          windowId: resizeState.windowId,
          newWidthPx: nextWidthPx,
          newHeightPx: nextHeightPx,
          viewportWorkHeightPx: layout.usableWorkHeightPx,
        })
      );
    };

    const handleResizePointerUp = () => {
      setResizeState(null);
    };

    window.addEventListener('pointermove', handleResizePointerMove);
    window.addEventListener('pointerup', handleResizePointerUp);
    return () => {
      window.removeEventListener('pointermove', handleResizePointerMove);
      window.removeEventListener('pointerup', handleResizePointerUp);
    };
  }, [
    resizeState,
    layout.usableWorkHeightPx,
    setState,
    state.config.outerMarginPx,
    state.config.viewportWidth,
    viewportScale,
  ]);

  // Global keyboard shortcuts matching DexAccessibilityService.kt onKeyEvent
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        if (e.key === '[' || (e.key === 'ArrowLeft' && !e.shiftKey)) {
          e.preventDefault();
          setState((prev) => cycleFocusHorizontal(prev, -1));
        } else if (e.key === ']' || (e.key === 'ArrowRight' && !e.shiftKey)) {
          e.preventDefault();
          setState((prev) => cycleFocusHorizontal(prev, 1));
        } else if (e.shiftKey && e.key === 'ArrowLeft') {
          e.preventDefault();
          setState((prev) => moveActiveColumnInStrip(prev, -1));
        } else if (e.shiftKey && e.key === 'ArrowRight') {
          e.preventDefault();
          setState((prev) => moveActiveColumnInStrip(prev, 1));
        } else if (e.key.toLowerCase() === 'r') {
          e.preventDefault();
          setState((prev) => cycleActiveColumnWidth(prev));
        } else if (e.key.toLowerCase() === 'g') {
          e.preventDefault();
          setState((prev) =>
            prev.focusedWindowId
              ? toggleStackWindowWithNeighbor(prev, prev.focusedWindowId)
              : prev
          );
        } else if (e.key.toLowerCase() === 'v') {
          e.preventDefault();
          setGroupViewOpen((v) => !v);
        } else if (e.key.toLowerCase() === 'c') {
          e.preventDefault();
          setState((prev) =>
            prev.focusedWindowId
              ? {
                  ...prev,
                  scrollOffsetPx: computeScrollToFocusWindow(
                    prev,
                    prev.focusedWindowId,
                    'center'
                  ),
                }
              : prev
          );
        } else if (e.code === 'Space' || e.key.toLowerCase() === 'k') {
          e.preventDefault();
          setQuickSwitcherOpen((v) => !v);
        }
      } else if (e.key === 'Escape') {
        if (quickSwitcherOpen) setQuickSwitcherOpen(false);
        if (snapAssistOpen) setSnapAssistOpen(false);
        if (groupViewOpen) setGroupViewOpen(false);
        if (openContextMenuWinId) setOpenContextMenuWinId(null);
        if (dragState) setDragState(null);
        if (resizeState) setResizeState(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quickSwitcherOpen, snapAssistOpen, groupViewOpen, openContextMenuWinId, dragState, resizeState, setState]);

  useEffect(() => {
    if (!openContextMenuWinId) return;
    const handlePointerDownOutside = () => {
      setOpenContextMenuWinId(null);
    };
    window.addEventListener('pointerdown', handlePointerDownOutside);
    return () => window.removeEventListener('pointerdown', handlePointerDownOutside);
  }, [openContextMenuWinId]);

  const handleStartWindowDrag = (
    e: React.PointerEvent,
    windowId: string
  ) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (!viewportContainerRef.current) return;

    const rect = viewportContainerRef.current.getBoundingClientRect();
    const scale = viewportScale || 0.72;
    const pointerScreenX = clamp(
      Math.round((e.clientX - rect.left) / scale),
      0,
      state.config.viewportWidth
    );
    const pointerScreenY = clamp(
      Math.round((e.clientY - rect.top) / scale),
      0,
      effectiveCanvasHeight
    );

    setState((prev) => ({
      ...prev,
      focusedWindowId: windowId,
    }));

    setDragState({
      windowId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      deltaScreenX: 0,
      deltaScreenY: 0,
      pointerScreenX,
      pointerScreenY,
    });
  };

  const handleStartWindowResize = (
    e: React.PointerEvent,
    windowId: string,
    initialWidthPx: number,
    initialHeightPx: number
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    setOpenContextMenuWinId(null);
    setState((prev) => ({
      ...prev,
      focusedWindowId: windowId,
    }));

    setResizeState({
      windowId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      initialWidthPx,
      initialHeightPx,
      currentWidthPx: initialWidthPx,
      currentHeightPx: initialHeightPx,
    });
  };

  const buildDirectSnapTarget = (
    draggedWindowId: string,
    targetColumnId: string,
    zone: SnapZoneType
  ): SnapDropTarget | null => {
    const colPlacements = layout.placements.filter((p) => p.columnId === targetColumnId);
    if (colPlacements.length === 0) return null;
    const firstP = colPlacements[0];
    const centerColX = Math.round((firstP.screenRect.left + firstP.screenRect.right) / 2);
    const usableTop = layout.usableTopPx;
    const usableBottom = layout.usableBottomPx;

    let probeX = centerColX;
    let probeY = Math.round((usableTop + usableBottom) / 2);

    if (zone === 'snap_left') {
      probeX = firstP.screenRect.left + 20;
    } else if (zone === 'snap_right') {
      probeX = firstP.screenRect.right - 20;
    } else if (zone === 'stack_top') {
      probeY = usableTop + 60;
    } else if (zone === 'stack_bottom') {
      probeY = usableBottom - 60;
    }

    return computeSnapDropTarget(
      effectiveState,
      layout,
      draggedWindowId,
      probeX,
      probeY
    );
  };

  const handleExecuteSnapTarget = (target: SnapDropTarget | null) => {
    if (!target) return;
    setState((prev) => applySnapDropAction(prev, target));
    setLastSnapActionLabel(target.label);
    setHoveredSnapPreview(null);
    setSnapAssistOpen(false);
  };

  const handleScrollDelta = (deltaPx: number) => {
    setState((prev) => {
      const currentLayout = computeStripLayout(prev);
      const nextScroll = clamp(
        Math.round(prev.scrollOffsetPx + deltaPx),
        0,
        currentLayout.maxScrollOffsetPx
      );
      return {
        ...prev,
        scrollOffsetPx: nextScroll,
      };
    });
  };

  const handleLaunchOrFocusDockApp = (dockApp: DockLaunchableApp) => {
    setState((prev) => {
      const existing = prev.windows[dockApp.id];
      if (existing) {
        return focusWindowAndScroll(prev, dockApp.id);
      }

      const newWin = {
        id: dockApp.id,
        taskId: dockApp.taskId,
        packageName: dockApp.packageName,
        activityName: dockApp.activityName,
        title: dockApp.title,
        subtitle: dockApp.subtitle,
        category: dockApp.category,
        accentColor: dockApp.accentColor,
        memoryMb: dockApp.memoryMb,
        isPinnedPip: false,
        isMinimized: false,
        lastFocusedAt: Date.now(),
      };

      const newCol = {
        id: `col-${dockApp.id}-${Date.now()}`,
        widthPreset: dockApp.defaultWidthPreset,
        windowIds: [dockApp.id],
        splitRatio: 0.5,
      };

      const nextState: StripWorkspaceState = {
        ...prev,
        windows: {
          ...prev.windows,
          [dockApp.id]: newWin,
        },
        columns: [...prev.columns, newCol],
        focusedWindowId: dockApp.id,
      };

      return {
        ...nextState,
        scrollOffsetPx: computeScrollToFocusWindow(nextState, dockApp.id),
      };
    });
  };

  const handleCloseWindow = (winId: string) => {
    setState((prev) => {
      const nextWindows = { ...prev.windows };
      delete nextWindows[winId];

      const nextColumns = prev.columns
        .map((c) => ({
          ...c,
          windowIds: c.windowIds.filter((id) => id !== winId),
        }))
        .filter((c) => c.windowIds.length > 0);

      const remainingIds = nextColumns.flatMap((c) => c.windowIds);
      const nextFocused =
        prev.focusedWindowId === winId
          ? remainingIds[0] || null
          : prev.focusedWindowId;

      const updated: StripWorkspaceState = {
        ...prev,
        windows: nextWindows,
        columns: nextColumns,
        focusedWindowId: nextFocused,
      };

      const nextLayout = computeStripLayout(updated);
      return {
        ...updated,
        scrollOffsetPx: clamp(updated.scrollOffsetPx, 0, nextLayout.maxScrollOffsetPx),
      };
    });
  };

  const handleToggleMinimize = (winId: string) => {
    setOpenContextMenuWinId(null);
    setState((prev) => {
      const target = prev.windows[winId];
      if (!target) return prev;
      const nextMinimized = !target.isMinimized;
      const updatedWindows = {
        ...prev.windows,
        [winId]: {
          ...target,
          isMinimized: nextMinimized,
          isPinnedPip: false,
        },
      };
      const updated: StripWorkspaceState = {
        ...prev,
        windows: updatedWindows,
      };
      const nextLayout = computeStripLayout(updated);
      return {
        ...updated,
        scrollOffsetPx: clamp(updated.scrollOffsetPx, 0, nextLayout.maxScrollOffsetPx),
      };
    });
  };

  const handleToggleFullscreenWindow = (winId: string) => {
    setOpenContextMenuWinId(null);
    setState((prev) => toggleWindowFullscreen(prev, winId));
  };

  const handleTogglePinPip = (winId: string) => {
    setState((prev) => {
      const target = prev.windows[winId];
      if (!target) return prev;
      const nextPip = !target.isPinnedPip;
      return {
        ...prev,
        windows: {
          ...prev.windows,
          [winId]: {
            ...target,
            isPinnedPip: nextPip,
            isMinimized: false,
          },
        },
      };
    });
  };

  const pinnedPipWindows = (Object.values(state.windows) as Array<StripWorkspaceState['windows'][string]>).filter(
    (w) => w.isPinnedPip && !w.isMinimized
  );
  const minimizedWindows = (Object.values(state.windows) as Array<StripWorkspaceState['windows'][string]>).filter(
    (w) => w.isMinimized
  );
  const focusedWin = state.focusedWindowId ? state.windows[state.focusedWindowId] : null;
  const focusedPlacement = state.focusedWindowId
    ? layout.placementByWindowId[state.focusedWindowId]
    : null;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-2.5 space-y-2.5">
      {/* Compact Single-Row Control Toolbar Above the Galaxy Tab A11+ Display */}
      <div className="relative flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-800 overflow-x-auto">
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setState((prev) => cycleFocusHorizontal(prev, -1))}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Sol (Alt+[)
          </button>
          <button
            type="button"
            onClick={() => setState((prev) => cycleFocusHorizontal(prev, 1))}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            Sağ (Alt+])
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setState((prev) => cycleActiveColumnWidth(prev))}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <Columns className="w-3.5 h-3.5 text-blue-400" />
            Genişlik (Alt+R)
          </button>

          <button
            type="button"
            onClick={() =>
              setState((prev) =>
                prev.focusedWindowId
                  ? toggleStackWindowWithNeighbor(prev, prev.focusedWindowId)
                  : prev
              )
            }
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <Rows className="w-3.5 h-3.5 text-emerald-400" />
            Dikey Grup (Alt+G)
          </button>

          <button
            type="button"
            onClick={() => setSnapAssistOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              snapAssistOpen
                ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200'
                : 'bg-emerald-950/50 hover:bg-emerald-900/50 border-emerald-500/40 text-emerald-300'
            }`}
          >
            <Magnet className="w-3.5 h-3.5" />
            Snap-to-Group
          </button>

          <button
            type="button"
            onClick={() => setGroupViewOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              groupViewOpen
                ? 'bg-teal-600/30 border-teal-400 text-teal-200'
                : 'bg-teal-950/50 hover:bg-teal-900/50 border-teal-500/40 text-teal-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Group-View ({layout.groupContainers.length})
          </button>

          <button
            type="button"
            onClick={() =>
              setState((prev) =>
                prev.focusedWindowId
                  ? {
                      ...prev,
                      scrollOffsetPx: computeScrollToFocusWindow(
                        prev,
                        prev.focusedWindowId,
                        'center'
                      ),
                    }
                  : prev
              )
            }
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <Crosshair className="w-3.5 h-3.5 text-amber-400" />
            Merkezle (Alt+C)
          </button>

          <button
            type="button"
            onClick={() => setQuickSwitcherOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
            Hızlı Geçiş (Alt+Space)
          </button>

          <button
            type="button"
            data-testid="spring-preset-toggle-btn"
            onClick={() => {
              const nextIdx =
                (SPRING_PRESET_ORDER.indexOf(springPresetId) + 1) %
                SPRING_PRESET_ORDER.length;
              setSpringPresetId(SPRING_PRESET_ORDER[nextIdx]);
            }}
            title={`Aktif Yay Fiziği: ${SPRING_PRESETS[springPresetId].label} · Aşım: %${springCurve.peakOvershootPct} · Süre: ${springCurve.durationMs}ms`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-cyan-950/50 hover:bg-cyan-900/50 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <span>
              Spring: k={springCurve.stiffness} c={springCurve.damping}
            </span>
          </button>
        </div>

        {/* Right: Strip Scroll Scrubber Slider & Mode Switch */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <label htmlFor="strip-camera-slider" className="font-mono text-[11px] text-slate-400 whitespace-nowrap">
              Şerit X:
            </label>
            <input
              id="strip-camera-slider"
              type="range"
              min={0}
              max={Math.max(1, layout.maxScrollOffsetPx)}
              value={state.scrollOffsetPx}
              onChange={(e) => {
                const val = Number(e.target.value);
                setState((prev) => ({ ...prev, scrollOffsetPx: val }));
              }}
              className="w-24 sm:w-32 accent-blue-500 cursor-pointer"
            />
            <span className="font-mono tabular-nums text-[11px] text-slate-200 whitespace-nowrap">
              {state.scrollOffsetPx} / {layout.maxScrollOffsetPx}px
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowBoundsHud((v) => !v)}
            className={`px-2.5 py-1.5 rounded text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
              showBoundsHud
                ? 'bg-slate-800 border-slate-700 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            Rect Göster
          </button>
        </div>
      </div>

      {/* Interactive Snap-to-Group Magnetic Assist Bar (When Open) */}
      {snapAssistOpen && focusedWin && (
        <div
          className="p-3 rounded-lg bg-slate-900/95 border border-emerald-500/40 flex flex-wrap items-center justify-between gap-3 text-xs"
          data-testid="snap-assist-panel"
        >
          <div className="flex items-center gap-2">
            <Magnet className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Snap-to-Group:</strong> Pencere başlığını doğrudan sürükleyip başka bir pencerenin üstüne/kenarına bırakın veya{' '}
              <strong className="text-emerald-300">{focusedWin.title}</strong> için hedef yapışma bölgesi seçin:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {state.columns.map((col, idx) => {
              const primaryId = col.windowIds.find((id) => id !== focusedWin.id) || col.windowIds[0];
              const targetW = state.windows[primaryId];
              if (!targetW) return null;
              const isOwnSingleCol = col.windowIds.length === 1 && col.windowIds[0] === focusedWin.id;
              if (isOwnSingleCol) return null;

              const shortName = targetW.title.split(' ')[0];

              return (
                <div
                  key={col.id}
                  className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800"
                >
                  <span className="font-mono text-[11px] text-slate-400 mr-1">
                    Sütun #{idx + 1} ({shortName}):
                  </span>
                  {col.id !== focusedPlacement?.columnId && (
                    <>
                      <button
                        type="button"
                        onMouseEnter={() =>
                          setHoveredSnapPreview(
                            buildDirectSnapTarget(focusedWin.id, col.id, 'stack_top')
                          )
                        }
                        onMouseLeave={() => setHoveredSnapPreview(null)}
                        onClick={() =>
                          handleExecuteSnapTarget(
                            buildDirectSnapTarget(focusedWin.id, col.id, 'stack_top')
                          )
                        }
                        className="px-2 py-0.5 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 font-medium transition-colors whitespace-nowrap"
                      >
                        Üste Grupla
                      </button>
                      <button
                        type="button"
                        onMouseEnter={() =>
                          setHoveredSnapPreview(
                            buildDirectSnapTarget(focusedWin.id, col.id, 'stack_bottom')
                          )
                        }
                        onMouseLeave={() => setHoveredSnapPreview(null)}
                        onClick={() =>
                          handleExecuteSnapTarget(
                            buildDirectSnapTarget(focusedWin.id, col.id, 'stack_bottom')
                          )
                        }
                        className="px-2 py-0.5 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 font-medium transition-colors whitespace-nowrap"
                      >
                        Alta Grupla
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onMouseEnter={() =>
                      setHoveredSnapPreview(
                        buildDirectSnapTarget(focusedWin.id, col.id, 'snap_left')
                      )
                    }
                    onMouseLeave={() => setHoveredSnapPreview(null)}
                    onClick={() =>
                      handleExecuteSnapTarget(
                        buildDirectSnapTarget(focusedWin.id, col.id, 'snap_left')
                      )
                    }
                    className="px-2 py-0.5 rounded bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 font-medium transition-colors whitespace-nowrap"
                  >
                    Soluna Yapıştır
                  </button>
                  <button
                    type="button"
                    onMouseEnter={() =>
                      setHoveredSnapPreview(
                        buildDirectSnapTarget(focusedWin.id, col.id, 'snap_right')
                      )
                    }
                    onMouseLeave={() => setHoveredSnapPreview(null)}
                    onClick={() =>
                      handleExecuteSnapTarget(
                        buildDirectSnapTarget(focusedWin.id, col.id, 'snap_right')
                      )
                    }
                    className="px-2 py-0.5 rounded bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 font-medium transition-colors whitespace-nowrap"
                  >
                    Sağına Yapıştır
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Group-View Container Inspector Panel (When Open) */}
      {groupViewOpen && (
        <div
          className="p-3.5 rounded-lg bg-slate-900/95 border border-teal-500/40 space-y-3 text-xs"
          data-testid="group-view-layer"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-400 shrink-0" />
              <span className="font-semibold text-slate-100">
                Group-View Konteynır Katmanı ({layout.groupContainers.length} Aktif Grup Konteynırı)
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400">
                Gruplanmış pencereler şerit üzerinde tek bir birleşik konteynır çerçevesi içinde yönetilir.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setHighlightGroupContainers((v) => !v)}
                className={`px-2.5 py-1 rounded border font-medium transition-colors ${
                  highlightGroupContainers
                    ? 'bg-teal-600/25 border-teal-400 text-teal-200'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                Tuval Konteynır Çerçevesi: {highlightGroupContainers ? 'Açık' : 'Kapalı'}
              </button>
              <button
                type="button"
                onClick={() => setGroupViewOpen(false)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Kapat
              </button>
            </div>
          </div>

          {layout.groupContainers.length === 0 ? (
            <div className="py-4 text-center text-slate-400 space-y-2">
              <div>Henüz dikey gruplanmış bir pencere konteynırı bulunmuyor.</div>
              <button
                type="button"
                onClick={() =>
                  setState((prev) =>
                    prev.focusedWindowId
                      ? toggleStackWindowWithNeighbor(prev, prev.focusedWindowId)
                      : prev
                  )
                }
                className="px-3 py-1.5 rounded bg-teal-600 hover:bg-teal-500 text-white font-medium"
              >
                Aktif Pencereyi Komşu Sütunla Grupla
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {layout.groupContainers.map((grp, gIdx) => {
                const topPercent = Math.round(grp.splitRatio * 100);
                const bottomPercent = 100 - topPercent;
                return (
                  <div
                    key={grp.groupId}
                    data-testid={`group-view-card-${grp.columnId}`}
                    className={`p-3 rounded-lg border transition-colors space-y-2.5 ${
                      grp.isFocusedGroup
                        ? 'bg-slate-950/95 border-teal-400/70'
                        : 'bg-slate-950/70 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-teal-500/20 border border-teal-500/40 text-teal-300 font-mono font-semibold text-[11px]">
                          Grup Konteynır #{gIdx + 1} · Sütun #{grp.columnIndex + 1}
                        </span>
                        <span className="font-mono tabular-nums text-[11px] text-slate-400">
                          [{grp.stripContainerRect.left}, {grp.stripContainerRect.top},{' '}
                          {grp.stripContainerRect.right}, {grp.stripContainerRect.bottom}]
                        </span>
                      </div>
                      <span className="font-mono tabular-nums text-[11px] text-emerald-400">
                        Toplam RAM: {grp.totalMemoryMb} MB
                      </span>
                    </div>

                    {/* Visual Container Member Windows List */}
                    <div className="p-2 rounded bg-slate-900/90 border border-teal-500/30 space-y-1.5">
                      {grp.windowIds.map((winId, stackIdx) => {
                        const w = state.windows[winId];
                        const p = layout.placementByWindowId[winId];
                        if (!w || !p) return null;
                        return (
                          <div
                            key={winId}
                            onClick={() =>
                              setState((prev) => focusWindowAndScroll(prev, winId))
                            }
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded cursor-pointer border transition-colors ${
                              p.isFocused
                                ? 'bg-blue-950/50 border-blue-500/60 text-white'
                                : 'bg-slate-950/80 border-slate-800/80 text-slate-200 hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-sm shrink-0"
                                style={{ backgroundColor: w.accentColor }}
                              />
                              <span className="font-semibold truncate">{w.title}</span>
                              <span className="font-mono text-[10px] text-slate-400">
                                ({stackIdx === 0 ? `Üst %${topPercent}` : `Alt %${bottomPercent}`})
                              </span>
                            </div>
                            <span className="font-mono tabular-nums text-[10px] text-cyan-400 shrink-0">
                              Rect({p.dexAppliedRect.left},{p.dexAppliedRect.top},{p.dexAppliedRect.right},{p.dexAppliedRect.bottom})
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Container-Level Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-slate-400 mr-1">Bölme:</span>
                        {[
                          { ratio: 0.35, label: '35/65' },
                          { ratio: 0.5, label: '50/50' },
                          { ratio: 0.65, label: '65/35' },
                        ].map((sp) => (
                          <button
                            key={sp.label}
                            type="button"
                            onClick={() =>
                              setState((prev) =>
                                setColumnSplitRatio(prev, grp.columnId, sp.ratio)
                              )
                            }
                            className={`px-2 py-0.5 rounded font-mono text-[11px] transition-colors ${
                              Math.abs(grp.splitRatio - sp.ratio) < 0.05
                                ? 'bg-teal-600 text-white'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {sp.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setState((prev) =>
                              focusWindowAndScroll(prev, grp.windowIds[0])
                            )
                          }
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium"
                        >
                          Gruba Odakla
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setState((prev) =>
                              swapGroupStackOrder(prev, grp.columnId)
                            )
                          }
                          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 font-medium"
                        >
                          <ArrowUpDown className="w-3 h-3" />
                          Üst↔Alt
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setState((prev) =>
                              unstackEntireGroup(prev, grp.columnId)
                            )
                          }
                          className="flex items-center gap-1 px-2 py-1 rounded bg-red-950/50 hover:bg-red-900/60 border border-red-500/30 text-red-300 font-medium"
                        >
                          <Ungroup className="w-3 h-3" />
                          Grubu Çöz
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Galaxy Tab A11+ WUXGA Interactive DeX Frame */}
      <div
        ref={viewportContainerRef}
        onWheel={(e) => {
          if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
            e.preventDefault();
            const delta = Math.abs(e.deltaX) > 0 ? e.deltaX : e.deltaY;
            handleScrollDelta(delta * 1.4);
          }
        }}
        className="relative w-full rounded-xl border border-slate-800 bg-[#070A10] overflow-hidden shadow-2xl select-none"
        style={{
          height: `${Math.round(effectiveCanvasHeight * viewportScale)}px`,
        }}
        data-testid="dex-viewport-frame"
      >
        {/* Inner 1920x960 Coordinate Surface Scaled Cleanly */}
        <div
          className="origin-top-left relative"
          style={{
            width: `${state.config.viewportWidth}px`,
            height: `${effectiveCanvasHeight}px`,
            transform: `scale(${viewportScale})`,
          }}
        >
          {/* 1. Top 36px Compose Strip Overlay HUD & Interactive Minimap (With Group Container Brackets!) */}
          <div className="absolute top-0 left-0 right-0 h-[36px] bg-slate-950/95 border-b border-slate-800/90 px-4 flex items-center justify-between gap-4 z-30 whitespace-nowrap overflow-hidden">
            <div className="flex items-center gap-2.5 text-xs whitespace-nowrap shrink-0">
              <span className="font-bold text-slate-100 tracking-tight">
                ŞeritDeX · Galaxy Tab A11+ (1920×1200 90Hz)
              </span>
              <span className="text-slate-600">·</span>
              <span className="font-mono tabular-nums text-slate-300">
                Görünür: {layout.visibleWindowCount}
              </span>
              <span className="text-slate-600">·</span>
              <span className="font-mono tabular-nums text-teal-300">
                Grup Konteynır: {layout.groupContainers.length}
              </span>
              <span className="text-slate-600">·</span>
              <span className="font-mono tabular-nums text-emerald-400">
                RAM: {layout.estimatedOverlayRamMb} MB
              </span>
              {lastSnapActionLabel && (
                <>
                  <span className="text-slate-600">·</span>
                  <span
                    className="font-mono text-emerald-300 truncate max-w-[220px]"
                    data-testid="last-snap-status"
                  >
                    Snap: {lastSnapActionLabel}
                  </span>
                </>
              )}
            </div>

            {/* Interactive Strip Minimap Pills (Grouped Columns Highlighted inside Unified Container Pill) */}
            <div className="flex items-center gap-1.5 shrink-0">
              {state.columns.map((col, colIdx) => {
                const colPlacements = layout.placements.filter(
                  (p) => p.columnId === col.id
                );
                if (colPlacements.length === 0) return null;

                if (colPlacements.length > 1) {
                  return (
                    <div
                      key={col.id}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-teal-950/80 border border-teal-500/60"
                      title={`Grup Konteynır Sütun #${colIdx + 1}`}
                    >
                      <span className="text-[10px] font-mono text-teal-300 font-semibold px-1">
                        G#{colIdx + 1}
                      </span>
                      {colPlacements.map((p) => {
                        const w = state.windows[p.windowId];
                        if (!w) return null;
                        return (
                          <button
                            key={p.windowId}
                            type="button"
                            onClick={() =>
                              setState((prev) =>
                                focusWindowAndScroll(prev, p.windowId)
                              )
                            }
                            className={`px-2 py-0.5 rounded text-[11px] font-mono tabular-nums transition-colors whitespace-nowrap shrink-0 ${
                              p.isFocused
                                ? 'bg-blue-600 text-white font-semibold'
                                : 'bg-slate-900 text-teal-200 hover:bg-slate-800'
                            }`}
                          >
                            #{w.taskId} {w.title.split(' ')[0]}
                          </button>
                        );
                      })}
                    </div>
                  );
                }

                const p = colPlacements[0];
                const w = state.windows[p.windowId];
                if (!w) return null;
                return (
                  <button
                    key={p.windowId}
                    type="button"
                    onClick={() =>
                      setState((prev) => focusWindowAndScroll(prev, p.windowId))
                    }
                    className={`px-2.5 py-0.5 rounded text-[11px] font-mono tabular-nums transition-colors whitespace-nowrap shrink-0 border ${
                      p.isFocused
                        ? 'bg-blue-600 text-white border-blue-400 font-semibold'
                        : p.visibilityState !== 'offscreen_parked'
                        ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                        : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    #{w.taskId} {w.title.split(' ')[0]}
                  </button>
                );
              })}
            </div>

            {/* Right Execution Mode Indicator */}
            <div className="flex items-center gap-2 text-xs font-mono shrink-0">
              <button
                type="button"
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    config: {
                      ...prev.config,
                      executionBackend:
                        prev.config.executionBackend === 'shizuku_binder'
                          ? 'standard_launch_bounds'
                          : 'shizuku_binder',
                    },
                  }))
                }
                className="px-2.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition-colors whitespace-nowrap shrink-0"
              >
                Köprü:{' '}
                {state.config.executionBackend === 'shizuku_binder'
                  ? 'Shizuku IActivityTaskManager'
                  : 'ActivityOptions.setLaunchBounds'}
              </button>
            </div>
          </div>

          {/* 2. Scrollable Horizontal Strip Window Layer + Group-View Container Frames */}
          <div className="absolute inset-0 pointer-events-none">
            {/* 2A. Unified Group-View Container Enclosures Around Stacked Columns */}
            {highlightGroupContainers &&
              layout.groupContainers.map((grp, grpIdx) => {
                const { left, top, right, bottom } = grp.screenContainerRect;
                const width = right - left;
                const height = bottom - top;
                const topPercent = Math.round(grp.splitRatio * 100);
                const bottomPercent = 100 - topPercent;
                const memberNames = grp.windowIds
                  .map((id) => state.windows[id]?.title.split(' ')[0])
                  .filter(Boolean)
                  .join(' + ');

                return (
                  <div
                    key={grp.groupId}
                    data-testid={`group-container-${grp.columnId}`}
                    style={{
                      transform: `translate3d(${left}px, ${top}px, 0)`,
                      width: `${width}px`,
                      height: `${height}px`,
                      transition: springCurve.transitionCss,
                    }}
                    className={`absolute top-0 left-0 rounded-2xl border-2 pointer-events-auto will-change-transform ${
                      grp.isFocusedGroup
                        ? 'border-teal-400/90 bg-teal-950/20 shadow-2xl z-10'
                        : 'border-teal-500/50 bg-slate-900/30 z-10'
                    }`}
                  >
                    {/* Unified Group Container Header Bar */}
                    <div className="h-[28px] px-3 bg-teal-950/90 border-b border-teal-500/40 rounded-t-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <Layers className="w-3.5 h-3.5 text-teal-300 shrink-0" />
                        <span className="font-bold text-teal-200 whitespace-nowrap">
                          Grup Konteynır #{grpIdx + 1}
                        </span>
                        <span className="text-teal-500">·</span>
                        <span className="font-mono text-[11px] text-teal-100 truncate">
                          {memberNames} ({grp.windowIds.length} Pencere)
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {[
                          { ratio: 0.35, label: '35/65' },
                          { ratio: 0.5, label: '50/50' },
                          { ratio: 0.65, label: '65/35' },
                        ].map((sp) => (
                          <button
                            key={sp.label}
                            type="button"
                            onClick={() =>
                              setState((prev) =>
                                setColumnSplitRatio(prev, grp.columnId, sp.ratio)
                              )
                            }
                            className={`px-1.5 py-0.5 rounded font-mono text-[10px] transition-colors ${
                              Math.abs(grp.splitRatio - sp.ratio) < 0.05
                                ? 'bg-teal-500 text-slate-950 font-bold'
                                : 'bg-slate-900/80 text-teal-200 hover:bg-slate-800'
                            }`}
                          >
                            {sp.label}
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={() =>
                            setState((prev) =>
                              swapGroupStackOrder(prev, grp.columnId)
                            )
                          }
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900/90 hover:bg-slate-800 text-teal-200 text-[11px] font-medium"
                          title="Grup içindeki pencerelerin üst/alt sırasını değiştir"
                        >
                          <ArrowUpDown className="w-3 h-3" />
                          Üst↔Alt
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setState((prev) =>
                              unstackEntireGroup(prev, grp.columnId)
                            )
                          }
                          className="px-2 py-0.5 rounded bg-red-950/80 hover:bg-red-900 text-red-200 text-[11px] font-medium"
                        >
                          Grubu Çöz
                        </button>
                      </div>
                    </div>

                    {/* Interactive Group Split Divider Pill Between Top and Bottom Windows */}
                    <div
                      style={{
                        top: `${grp.dividerScreenY - top - 6}px`,
                        transition: `top ${springCurve.durationMs}ms ${springCurve.easingCss}`,
                      }}
                      className="absolute left-1/2 -translate-x-1/2 z-30 px-2.5 py-0.5 rounded-full bg-teal-950 border border-teal-400/80 text-[10px] font-mono text-teal-200 shadow"
                    >
                      Grup Bölme: %{topPercent} / %{bottomPercent}
                    </div>
                  </div>
                );
              })}

            {/* 2B. Individual Windows on the Strip (Animated with 90Hz DeX Hooke Spring Physics) */}
            {layout.placements.map((placement) => {
              const win = state.windows[placement.windowId];
              const col = state.columns.find((c) => c.id === placement.columnId);
              if (!win || !col) return null;

              const isBeingDragged = dragState?.windowId === win.id;
              const isBeingResized = resizeState?.windowId === win.id;
              const { left, top, right, bottom } = placement.screenRect;
              const width = right - left;
              const height = bottom - top;

              const renderX = isBeingDragged
                ? left + (dragState?.deltaScreenX ?? 0)
                : left;
              const renderY = isBeingDragged
                ? top + (dragState?.deltaScreenY ?? 0)
                : top;

              const scaleFactor = isBeingDragged
                ? 1.012
                : isBeingResized
                ? 1.004
                : 1;

              const activeTransitionCss = isBeingDragged
                ? springCurve.activeDragTransitionCss
                : isBeingResized
                ? springCurve.activeResizeTransitionCss
                : springCurve.transitionCss;

              return (
                <div
                  key={placement.windowId}
                  data-testid={`dex-window-${win.id}`}
                  data-spring-mode={
                    isBeingDragged
                      ? 'drag-spring'
                      : isBeingResized
                      ? 'resize-spring'
                      : 'layout-spring'
                  }
                  onClick={() => {
                    if (!placement.isFocused && !dragState && !resizeState) {
                      setState((prev) => focusWindowAndScroll(prev, win.id));
                    }
                  }}
                  style={{
                    transform: `translate3d(${renderX}px, ${renderY}px, 0) scale(${scaleFactor})`,
                    width: `${width}px`,
                    height: `${height}px`,
                    transition: activeTransitionCss,
                  }}
                  className={`absolute top-0 left-0 pointer-events-auto flex flex-col rounded-xl overflow-hidden border will-change-transform ${
                    isBeingDragged
                      ? 'border-emerald-400 bg-slate-900/90 shadow-2xl z-30 opacity-90 ring-2 ring-emerald-400/50'
                      : isBeingResized
                      ? 'border-cyan-400 bg-slate-900 shadow-2xl z-40 ring-2 ring-cyan-400/50'
                      : openContextMenuWinId === win.id
                      ? 'border-blue-400 bg-slate-900 shadow-2xl z-40'
                      : placement.isFocused
                      ? 'border-blue-500 bg-slate-900 shadow-2xl z-20'
                      : placement.stackCount > 1
                      ? 'border-teal-500/40 bg-slate-950/95 opacity-95 hover:border-teal-400/70 z-20'
                      : 'border-slate-800 bg-slate-950/95 opacity-95 hover:border-slate-700 z-10'
                  }`}
                >
                  {/* Android Freeform Window Header Bar (Draggable for Snap-to-Group + Right-Click Context Menu!) */}
                  <div
                    onPointerDown={(e) => handleStartWindowDrag(e, win.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpenContextMenuWinId((prev) => (prev === win.id ? null : win.id));
                    }}
                    data-testid={`window-drag-header-${win.id}`}
                    className={`flex items-center justify-between px-3.5 py-2 border-b select-none cursor-grab active:cursor-grabbing ${
                      placement.isFocused
                        ? 'bg-slate-900 border-slate-800'
                        : 'bg-slate-950 border-slate-800/80'
                    }`}
                  >
                    {/* Left: Drag Handle + App Title & Task ID */}
                    <div className="flex items-center gap-2 min-w-0">
                      <GripVertical className="w-4 h-4 text-slate-500 shrink-0" />
                      <span
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: win.accentColor }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-100 truncate">
                            {win.title}
                          </span>
                          <span className="font-mono tabular-nums text-[11px] text-slate-400">
                            Task #{win.taskId}
                          </span>
                          {placement.stackCount > 1 && (
                            <span className="px-1.5 py-0.5 rounded bg-teal-500/20 border border-teal-500/40 text-[10px] font-mono text-teal-300">
                              Grup #{placement.stackIndex + 1}/{placement.stackCount}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate">
                          {win.packageName} · Sürükle & Grupla
                        </div>
                      </div>
                    </div>

                    {/* Center: Ergonomic Touch / Mouse Width Presets & Stack Controls */}
                    <div
                      className="flex items-center gap-1 bg-slate-950/90 p-1 rounded-lg border border-slate-800 cursor-default"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {(['1/3', '1/2', '2/3', 'full'] as WidthPreset[]).map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() =>
                            setState((prev) =>
                              setColumnWidthPreset(prev, col.id, preset)
                            )
                          }
                          className={`px-2 py-1 rounded text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 ${
                            col.widthPreset === preset
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                          }`}
                        >
                          {preset === 'full' ? 'Tam' : preset}
                        </button>
                      ))}

                      <div className="w-px h-4 bg-slate-800 mx-0.5" />

                      <button
                        type="button"
                        onClick={() =>
                          setState((prev) =>
                            toggleStackWindowWithNeighbor(prev, win.id)
                          )
                        }
                        title="Komşu sütunla dikey grupla veya grubu çöz (Alt+G)"
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          placement.stackCount > 1
                            ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {placement.stackCount > 1 ? 'Grubu Çöz' : 'Dikey Grup'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setState((prev) => {
                            const focused = focusWindowAndScroll(prev, win.id);
                            return moveActiveColumnInStrip(focused, -1);
                          });
                        }}
                        title="Sütunu sola taşı"
                        className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                        aria-label={`${win.title} sütununu sola taşı`}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setState((prev) => {
                            const focused = focusWindowAndScroll(prev, win.id);
                            return moveActiveColumnInStrip(focused, 1);
                          });
                        }}
                        title="Sütunu sağa taşı"
                        className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                        aria-label={`${win.title} sütununu sağa taşı`}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Right: Pin PIP, Minimize, Close + Top-Right Action Context Menu */}
                    <div
                      className="relative flex items-center gap-1 cursor-default"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => handleTogglePinPip(win.id)}
                        className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition-colors"
                        title="Köşeye Sabitle (PIP)"
                        aria-label={`${win.title} penceresini köşeye sabitle`}
                      >
                        <Pin className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleMinimize(win.id)}
                        className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                        title="Simge durumuna küçült"
                        aria-label={`${win.title} penceresini küçült`}
                      >
                        <Minimize2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenContextMenuWinId(null);
                          handleCloseWindow(win.id);
                        }}
                        className="p-1.5 rounded hover:bg-red-950/60 text-slate-400 hover:text-red-400 transition-colors"
                        title="Pencereyi Kapat"
                        aria-label={`${win.title} penceresini kapat`}
                      >
                        <X className="w-4 h-4" />
                      </button>

                      <div className="w-px h-4 bg-slate-800 mx-0.5" />

                      {/* Top-Right Context Menu Trigger Button */}
                      <button
                        type="button"
                        data-testid={`window-context-menu-trigger-${win.id}`}
                        aria-label={`${win.title} eylem menüsü`}
                        aria-haspopup="menu"
                        aria-expanded={openContextMenuWinId === win.id}
                        title="Pencere Eylem Menüsü (Sağ Tık / Menü)"
                        onClick={() =>
                          setOpenContextMenuWinId((prev) =>
                            prev === win.id ? null : win.id
                          )
                        }
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-colors ${
                          openContextMenuWinId === win.id
                            ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700/80'
                        }`}
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                        <span>Menü</span>
                      </button>
                    </div>
                  </div>

                  {/* Top-Right Floating Context Menu (Eylem Menüsü) */}
                  {openContextMenuWinId === win.id && (
                    <div
                      role="menu"
                      aria-label={`${win.title} Eylem Menüsü`}
                      data-testid={`window-context-menu-${win.id}`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-12 right-3.5 z-50 w-64 rounded-xl bg-slate-900/98 backdrop-blur-md border border-slate-700 shadow-2xl p-1.5 flex flex-col gap-0.5 text-left"
                    >
                      <div className="px-2.5 py-1.5 border-b border-slate-800 flex items-center justify-between">
                        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 truncate">
                          Pencere Eylem Menüsü
                        </span>
                        <span className="text-[10px] font-mono tabular-nums text-blue-400">
                          Task #{win.taskId}
                        </span>
                      </div>

                      <button
                        type="button"
                        role="menuitem"
                        data-testid={`context-menu-fullscreen-${win.id}`}
                        onClick={() => handleToggleFullscreenWindow(win.id)}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-slate-100 hover:bg-blue-600/25 hover:text-blue-200 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <Maximize2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span>Tam ekran yap</span>
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {col.widthPreset === 'full' && placement.stackCount === 1
                            ? '1/2 Döndür'
                            : 'Tam (1/1)'}
                        </span>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        data-testid={`context-menu-minimize-${win.id}`}
                        onClick={() => handleToggleMinimize(win.id)}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-slate-100 hover:bg-slate-800 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <Minimize2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Simge durumuna küçült</span>
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          Şerit Rafı
                        </span>
                      </button>

                      <div className="h-px bg-slate-800 my-0.5" />

                      <button
                        type="button"
                        role="menuitem"
                        data-testid={`context-menu-close-${win.id}`}
                        onClick={() => {
                          setOpenContextMenuWinId(null);
                          handleCloseWindow(win.id);
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-red-300 hover:bg-red-950/60 hover:text-red-200 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <X className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          <span>Kapat</span>
                        </span>
                        <span className="text-[10px] font-mono text-red-400/80">
                          Alt+W
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Live Android Rect Telemetry Strip (Optional Toggle) */}
                  {showBoundsHud && (
                    <div className="px-3.5 py-1 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-400">
                      <span>
                        stripRect: [{placement.stripRect.left}, {placement.stripRect.top},{' '}
                        {placement.stripRect.right}, {placement.stripRect.bottom}]
                      </span>
                      <span className="text-cyan-400">
                        dexAppliedRect: [{placement.dexAppliedRect.left},{' '}
                        {placement.dexAppliedRect.top}, {placement.dexAppliedRect.right},{' '}
                        {placement.dexAppliedRect.bottom}]
                      </span>
                      <span>
                        Görünürlük: {Math.round(placement.visibleRatio * 100)}% (
                        {placement.visibilityState === 'fully_visible'
                          ? 'Tam'
                          : placement.visibilityState === 'partially_visible'
                          ? 'Kısmi'
                          : '24px Kenar Park'}
                        )
                      </span>
                    </div>
                  )}

                  {/* Interactive Android Application Content */}
                  <div className="relative flex-1 min-h-0 overflow-hidden">
                    <DexWindowBody
                      win={win}
                      placement={placement}
                      layout={layout}
                      allWindows={state.windows}
                      executionBackend={state.config.executionBackend}
                      onTriggerExportProject={onTriggerExportProject}
                      onFocusWindow={(id) =>
                        setState((prev) => focusWindowAndScroll(prev, id))
                      }
                    />

                    {/* Live Resize Dimension & stripLayoutEngine Telemetry Badge while Resizing */}
                    {isBeingResized && (
                      <div
                        data-testid={`window-resize-hud-${win.id}`}
                        className="absolute bottom-10 right-3 z-40 px-3 py-2 rounded-lg bg-slate-950/95 border border-cyan-400 shadow-2xl font-mono tabular-nums text-xs text-cyan-200 pointer-events-none space-y-0.5"
                      >
                        <div className="font-bold text-white">
                          Boyutlandırılıyor: {width} × {height} px
                        </div>
                        <div className="text-[11px] text-cyan-300">
                          stripRect: [{placement.stripRect.left}, {placement.stripRect.top},{' '}
                          {placement.stripRect.right}, {placement.stripRect.bottom}]
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Genişlik Oranı: %{Math.round((col.customWidthRatio ?? 0.5) * 100)} ·
                          Yükseklik Oranı: %{Math.round((col.customHeightRatio ?? 1.0) * 100)} ·
                          Spring (k={springCurve.stiffness}, c={springCurve.damping})
                        </div>
                      </div>
                    )}

                    {/* Bottom-Right Drag-to-Resize Handle (Sağ Alt Köşe Boyut Değiştirme Tutamacı) */}
                    <div
                      role="separator"
                      aria-label={`${win.title} boyut değiştirme tutamacı`}
                      data-testid={`window-resize-handle-${win.id}`}
                      title="Sürükleyerek Boyutlandır (Genişlik & Yükseklik) · Çift Tıkla: Sıfırla"
                      onPointerDown={(e) =>
                        handleStartWindowResize(e, win.id, width, height)
                      }
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setState((prev) =>
                          setColumnWidthPreset(prev, col.id, col.widthPreset)
                        );
                      }}
                      className={`group absolute bottom-0 right-0 z-30 flex items-center gap-1.5 pl-2.5 pr-2 py-1 rounded-tl-lg border-t border-l select-none cursor-nwse-resize transition-colors ${
                        isBeingResized
                          ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-lg'
                          : col.customWidthRatio || col.customHeightRatio
                          ? 'bg-slate-900/95 hover:bg-cyan-950/90 text-cyan-300 border-cyan-500/50'
                          : 'bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 border-slate-700/80'
                      }`}
                    >
                      <span className="font-mono tabular-nums text-[10px] font-medium tracking-tight">
                        {width}×{height}
                      </span>
                      <svg
                        className="w-3.5 h-3.5 shrink-0"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                      >
                        <path d="M14 6L6 14" />
                        <path d="M14 10L10 14" />
                        <path d="M14 14L13.5 14" />
                      </svg>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* 2C. Magnetic Snap-to-Group & Edge-Snap Live Preview Overlay (Spring Animated) */}
            {liveDragSnapTarget && (
              <div
                data-testid="snap-preview-overlay"
                style={{
                  transform: `translate3d(${liveDragSnapTarget.previewScreenRect.left}px, ${liveDragSnapTarget.previewScreenRect.top}px, 0)`,
                  width: `${
                    liveDragSnapTarget.previewScreenRect.right -
                    liveDragSnapTarget.previewScreenRect.left
                  }px`,
                  height: `${
                    liveDragSnapTarget.previewScreenRect.bottom -
                    liveDragSnapTarget.previewScreenRect.top
                  }px`,
                  transition: springCurve.transitionCss,
                }}
                className={`absolute top-0 left-0 z-50 rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-4 pointer-events-none will-change-transform ${
                  liveDragSnapTarget.zone === 'stack_top' ||
                  liveDragSnapTarget.zone === 'stack_bottom'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                    : 'bg-blue-500/20 border-blue-400 text-blue-200'
                }`}
              >
                <div className="px-4 py-2.5 rounded-lg bg-slate-950/95 border border-emerald-400 shadow-2xl text-center space-y-1">
                  <div className="flex items-center justify-center gap-2 text-sm font-bold text-white">
                    <Magnet className="w-4 h-4 text-emerald-400" />
                    <span>{liveDragSnapTarget.label}</span>
                  </div>
                  <div className="font-mono tabular-nums text-xs text-emerald-300">
                    Hedef Rect: [{liveDragSnapTarget.previewStripRect.left},{' '}
                    {liveDragSnapTarget.previewStripRect.top},{' '}
                    {liveDragSnapTarget.previewStripRect.right},{' '}
                    {liveDragSnapTarget.previewStripRect.bottom}] · Spring (k=
                    {springCurve.stiffness}, c={springCurve.damping})
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. Pinned Floating PIP Windows (Always-on-top of Strip) */}
          {pinnedPipWindows.map((pipWin, idx) => (
            <div
              key={pipWin.id}
              style={{
                right: `${24 + idx * 380}px`,
                bottom: `76px`,
                width: '360px',
                height: '240px',
              }}
              className="absolute z-30 rounded-xl border-2 border-amber-500/80 bg-slate-900 shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950 border-b border-slate-800">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                  <Pin className="w-3.5 h-3.5" />
                  <span>{pipWin.title} (PIP Sabit)</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleTogglePinPip(pipWin.id)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
                >
                  Şeride Döndür
                </button>
              </div>
              <div className="flex-1 p-3 text-xs text-slate-300 bg-slate-950/95 flex flex-col justify-between">
                <p>
                  Bu pencere yatay şeritten bağımsız olarak DeX ekranının sağ alt köşesine sabitlendi (<code className="text-amber-300">FLAG_ALWAYS_ON_TOP</code>).
                </p>
                <div className="font-mono text-[11px] text-slate-400">
                  Sabit Koordinat: Rect(1536, 884, 1896, 1124)
                </div>
              </div>
            </div>
          ))}

          {/* 4. Bottom 56px Samsung DeX Taskbar & App Dock */}
          <div className="absolute bottom-0 left-0 right-0 h-[56px] bg-slate-950/95 border-t border-slate-800/90 px-4 flex items-center justify-between z-30">
            {/* Left: DeX Launcher & Focused Window Summary */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuickSwitcherOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                DeX Uygulamalar
              </button>
              {focusedWin && focusedPlacement && (
                <div className="text-xs text-slate-300 font-mono tabular-nums">
                  Aktif: <strong className="text-white">{focusedWin.title}</strong> · Sütun #
                  {focusedPlacement.columnIndex + 1}
                </div>
              )}
            </div>

            {/* Center: Launchable & Open DeX Applications */}
            <div className="flex items-center gap-2">
              {DOCK_APPS.map((dockApp) => {
                const openWin = state.windows[dockApp.id];
                const isFocused = state.focusedWindowId === dockApp.id;
                return (
                  <button
                    key={dockApp.id}
                    type="button"
                    onClick={() => handleLaunchOrFocusDockApp(dockApp)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                      isFocused
                        ? 'bg-slate-800 border-blue-500 text-white'
                        : openWin
                        ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                        : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: dockApp.accentColor }}
                    />
                    <span>{dockApp.title.split(' ')[0]}</span>
                    {!openWin && <Plus className="w-3 h-3 text-slate-500" />}
                  </button>
                );
              })}
            </div>

            {/* Right: Minimized Shelf & System Clock */}
            <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-300">
              {minimizedWindows.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Raf ({minimizedWindows.length}):</span>
                  {minimizedWindows.map((mw) => (
                    <button
                      key={mw.id}
                      type="button"
                      onClick={() =>
                        setState((prev) => focusWindowAndScroll(prev, mw.id))
                      }
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px]"
                    >
                      {mw.title.split(' ')[0]} ↑
                    </button>
                  ))}
                </div>
              )}
              <span>90Hz · DeX</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Switcher Modal (Alt + Space) */}
      {quickSwitcherOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setQuickSwitcherOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="ŞeritDeX Hızlı Geçiş Paleti"
          >
            <div className="p-3.5 border-b border-slate-800 flex items-center gap-2.5">
              <Search className="w-4 h-4 text-blue-400 shrink-0" />
              <label htmlFor="quick-switcher-input" className="sr-only">
                Pencere veya uygulama ara
              </label>
              <input
                id="quick-switcher-input"
                type="text"
                autoFocus
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                placeholder="Pencere odakla veya yeni DeX uygulaması başlat..."
                className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setQuickSwitcherOpen(false)}
                className="px-2 py-1 rounded bg-slate-800 text-xs text-slate-300"
              >
                Kapat
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60">
              {DOCK_APPS.filter(
                (a) =>
                  a.title.toLowerCase().includes(quickSearch.toLowerCase()) ||
                  a.packageName.toLowerCase().includes(quickSearch.toLowerCase())
              ).map((app) => {
                const isOpen = Boolean(state.windows[app.id]);
                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => {
                      handleLaunchOrFocusDockApp(app);
                      setQuickSwitcherOpen(false);
                      setQuickSearch('');
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-slate-800/80 flex items-center justify-between transition-colors"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-100">
                        {app.title}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {app.packageName}
                      </div>
                    </div>
                    <span className="text-xs font-mono text-blue-400">
                      {isOpen ? 'Şeritte Odakla →' : 'Şeride Ekle +'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
