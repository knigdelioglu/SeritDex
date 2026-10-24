import {
  DEFAULT_TAB_A11_PLUS_CONFIG,
  DexAppWindow,
  StripWorkspaceState,
} from '../engine/stripLayoutEngine';

export interface DockLaunchableApp {
  id: string;
  taskId: number;
  packageName: string;
  activityName: string;
  title: string;
  subtitle: string;
  category: DexAppWindow['category'];
  accentColor: string;
  memoryMb: number;
  defaultWidthPreset: '1/3' | '1/2' | '2/3' | 'full';
}

export const DOCK_APPS: DockLaunchableApp[] = [
  {
    id: 'win-notes',
    taskId: 401,
    packageName: 'com.samsung.android.app.notes',
    activityName: '.memolist.MemoListActivity',
    title: 'Samsung Notes',
    subtitle: 'Tab A11+ ŞeritDeX Ergonomi Notları.sdocx',
    category: 'productivity',
    accentColor: '#F59E0B',
    memoryMb: 128,
    defaultWidthPreset: '1/2',
  },
  {
    id: 'win-termux',
    taskId: 402,
    packageName: 'com.termux',
    activityName: '.app.TermuxActivity',
    title: 'Termux — DeX & Shizuku Kabuğu',
    subtitle: 'IActivityTaskManager.resizeTask @ 90Hz',
    category: 'development',
    accentColor: '#10B981',
    memoryMb: 84,
    defaultWidthPreset: '1/2',
  },
  {
    id: 'win-chrome',
    taskId: 403,
    packageName: 'com.android.chrome',
    activityName: 'com.google.android.apps.chrome.Main',
    title: 'Chrome (DeX Masaüstü)',
    subtitle: 'Android 15 Multi-Window & DeX Geliştirici Rehberi',
    category: 'browser',
    accentColor: '#3B82F6',
    memoryMb: 286,
    defaultWidthPreset: '2/3',
  },
  {
    id: 'win-files',
    taskId: 404,
    packageName: 'com.sec.android.app.myfiles',
    activityName: '.external.ui.MainActivity',
    title: 'Dosyalarım (My Files)',
    subtitle: '/sdcard/Download/SeritDeX-Builds',
    category: 'files',
    accentColor: '#8B5CF6',
    memoryMb: 92,
    defaultWidthPreset: '1/3',
  },
  {
    id: 'win-inspector',
    taskId: 405,
    packageName: 'tr.seritdex.wm',
    activityName: '.inspector.BoundsTelemetryActivity',
    title: 'ŞeritDeX Bounds Denetleyici',
    subtitle: 'AccessibilityWindowInfo & Rect Canlı İzleyici',
    category: 'system',
    accentColor: '#06B6D4',
    memoryMb: 14,
    defaultWidthPreset: '1/2',
  },
  {
    id: 'win-media',
    taskId: 406,
    packageName: 'com.spotify.music',
    activityName: '.MainActivity',
    title: 'Medya & Odak Ses',
    subtitle: 'Binaural Odak Akışı — DeX Arka Plan',
    category: 'media',
    accentColor: '#EC4899',
    memoryMb: 116,
    defaultWidthPreset: '1/3',
  },
];

export function createInitialWorkspaceState(): StripWorkspaceState {
  const initialIds = ['win-notes', 'win-termux', 'win-chrome', 'win-files', 'win-inspector'];
  const windows: Record<string, DexAppWindow> = {};

  initialIds.forEach((id, idx) => {
    const template = DOCK_APPS.find((a) => a.id === id)!;
    windows[id] = {
      id: template.id,
      taskId: template.taskId,
      packageName: template.packageName,
      activityName: template.activityName,
      title: template.title,
      subtitle: template.subtitle,
      category: template.category,
      accentColor: template.accentColor,
      memoryMb: template.memoryMb,
      isPinnedPip: false,
      isMinimized: false,
      lastFocusedAt: Date.now() - (initialIds.length - idx) * 1000,
    };
  });

  return {
    config: { ...DEFAULT_TAB_A11_PLUS_CONFIG },
    windows,
    columns: [
      {
        id: 'col-1',
        widthPreset: '1/2',
        windowIds: ['win-notes'],
        splitRatio: 0.5,
      },
      {
        id: 'col-2',
        widthPreset: '1/2',
        windowIds: ['win-termux'],
        splitRatio: 0.5,
      },
      {
        id: 'col-3',
        widthPreset: '2/3',
        windowIds: ['win-chrome'],
        splitRatio: 0.5,
      },
      {
        id: 'col-4',
        widthPreset: '1/2',
        windowIds: ['win-files', 'win-inspector'], // Pre-demonstrates vertical 2-window column stacking!
        splitRatio: 0.48,
      },
    ],
    focusedWindowId: 'win-notes',
    scrollOffsetPx: 0,
  };
}
