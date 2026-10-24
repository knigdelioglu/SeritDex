import React, { useState } from 'react';
import {
  ComputedStripLayout,
  ComputedWindowPlacement,
  DexAppWindow,
  ExecutionBackend,
} from '../engine/stripLayoutEngine';
import {
  Terminal,
  FileCode,
  FolderOpen,
  Download,
  CheckCircle2,
  Play,
  Pause,
  SkipForward,
  Sliders,
} from 'lucide-react';

interface DexWindowBodyProps {
  win: DexAppWindow;
  placement: ComputedWindowPlacement;
  layout: ComputedStripLayout;
  allWindows: Record<string, DexAppWindow>;
  executionBackend: ExecutionBackend;
  onTriggerExportProject: () => void;
  onFocusWindow: (id: string) => void;
}

export const DexWindowBody: React.FC<DexWindowBodyProps> = ({
  win,
  placement,
  layout,
  allWindows,
  executionBackend,
  onTriggerExportProject,
  onFocusWindow,
}) => {
  const [noteText, setNoteText] = useState(
    `Galaxy Tab A11+ (SM-X210 / 1920×1200 90Hz) DeX Pencere Yöneticisi Notları:\n\n` +
      `1. ŞeritMac (PaperWM/Niri) yatay akışı Android Freeform katmanına uyarlandı.\n` +
      `2. Samsung One UI WindowManager ekran dışına taşan pencereleri sınırlandırır (clamping). ŞeritDeX, görünür pencereleri tam Rect(left, top, right, bottom) koordinatına yerleştirirken ekran dışı pencereleri 24px kenar park yuvasında tutar.\n` +
      `3. Dokunmatik ekran için üst 36dp Şerit Haritası (Minimap), klavye için Alt+[ / ] ve Alt+R kısayolları eklendi.`
  );

  const [terminalHistory, setTerminalHistory] = useState<Array<{ cmd: string; out: string }>>([
    {
      cmd: 'wm size && wm density',
      out: 'Physical size: 1920x1200 (WUXGA 16:10 @ 90Hz)\nPhysical density: 240 dpi (DeX Desktop Mode: ACTIVE)',
    },
    {
      cmd: 'shizuku status',
      out: 'Shizuku v13.1.5 binder: ACTIVE (uid=2000 shell) -> IActivityTaskManager.resizeTask hazır',
    },
  ]);
  const [terminalInput, setTerminalInput] = useState('');

  const [activeBrowserTab, setActiveBrowserTab] = useState<'freeform' | 'dex_clamping' | 'input'>('freeform');
  const [isPlayingMedia, setIsPlayingMedia] = useState(true);
  const [mediaProgress, setMediaProgress] = useState(64);

  const runShellCommand = (rawCmd: string) => {
    const cmd = rawCmd.trim();
    if (!cmd) return;
    let out = '';
    if (cmd === 'dumpsys window' || cmd === 'seritdex bounds') {
      out = layout.placements
        .map(
          (p) =>
            `Task #${allWindows[p.windowId]?.taskId} [${p.windowId}] -> dexAppliedRect(${p.dexAppliedRect.left}, ${p.dexAppliedRect.top}, ${p.dexAppliedRect.right}, ${p.dexAppliedRect.bottom}) [${p.visibilityState}]`
        )
        .join('\n');
    } else if (cmd === 'free -m') {
      out = `MemTotal: 8192 MB | SeritDeX Overlay RSS: ${layout.estimatedOverlayRamMb} MB | Zero-GC Pool: ACTIVE`;
    } else if (cmd === 'help') {
      out = 'Kullanılabilir komutlar: seritdex bounds, dumpsys window, free -m, wm size';
    } else {
      out = `[OK] Executed on Galaxy Tab A11+ DeX Binder (${executionBackend}): ${cmd}`;
    }
    setTerminalHistory((prev) => [...prev.slice(-5), { cmd, out }]);
    setTerminalInput('');
  };

  if (win.id === 'win-notes') {
    return (
      <div className="flex flex-col h-full bg-slate-950/90 text-slate-200 p-4 select-text">
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800/80 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-amber-400">Not Defteri</span>
            <span aria-hidden="true">·</span>
            <span>S-Pen & Klavye Senkronize</span>
          </div>
          <span className="font-mono tabular-nums text-xs text-slate-400">
            {noteText.length} karakter
          </span>
        </div>
        <label htmlFor={`note-editor-${win.id}`} className="sr-only">
          Samsung Notes İçeriği
        </label>
        <textarea
          id={`note-editor-${win.id}`}
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          className="w-full flex-1 bg-transparent resize-none text-sm leading-relaxed text-slate-200 focus:outline-none font-sans"
        />
      </div>
    );
  }

  if (win.id === 'win-termux') {
    return (
      <div className="flex flex-col h-full bg-[#090D14] text-emerald-400 p-4 font-mono text-sm">
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800/80 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>u0_a214@gts9fe-tab-a11plus:~/seritdex</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => runShellCommand('seritdex bounds')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition-colors whitespace-nowrap shrink-0"
            >
              seritdex bounds
            </button>
            <button
              type="button"
              onClick={() => runShellCommand('free -m')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition-colors whitespace-nowrap shrink-0"
            >
              free -m
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {terminalHistory.map((item, idx) => (
            <div key={idx} className="space-y-1">
              <div className="text-slate-200">
                <span className="text-emerald-400">$</span> {item.cmd}
              </div>
              <pre className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed">
                {item.out}
              </pre>
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runShellCommand(terminalInput);
          }}
          className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex items-center gap-2"
        >
          <span className="text-emerald-400 font-semibold">$</span>
          <label htmlFor="termux-cmd-input" className="sr-only">
            Termux Komutu
          </label>
          <input
            id="termux-cmd-input"
            type="text"
            value={terminalInput}
            onChange={(e) => setTerminalInput(e.target.value)}
            placeholder="Komut yazın (örn: seritdex bounds, free -m)..."
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            className="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded text-xs whitespace-nowrap shrink-0"
          >
            Çalıştır
          </button>
        </form>
      </div>
    );
  }

  if (win.id === 'win-chrome') {
    return (
      <div className="flex flex-col h-full bg-slate-950 text-slate-200">
        <div className="flex items-center gap-1 px-3 pt-2 bg-slate-900 border-b border-slate-800">
          <button
            type="button"
            onClick={() => setActiveBrowserTab('freeform')}
            className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors whitespace-nowrap shrink-0 ${
              activeBrowserTab === 'freeform'
                ? 'bg-slate-950 text-blue-400 border-t border-x border-slate-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            1. Android Freeform API
          </button>
          <button
            type="button"
            onClick={() => setActiveBrowserTab('dex_clamping')}
            className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors whitespace-nowrap shrink-0 ${
              activeBrowserTab === 'dex_clamping'
                ? 'bg-slate-950 text-blue-400 border-t border-x border-slate-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            2. DeX Ekran Dışı Clamping Çözümü
          </button>
          <button
            type="button"
            onClick={() => setActiveBrowserTab('input')}
            className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors whitespace-nowrap shrink-0 ${
              activeBrowserTab === 'input'
                ? 'bg-slate-950 text-blue-400 border-t border-x border-slate-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            3. 90Hz Dokunmatik & Trackpad
          </button>
        </div>

        <div className="p-3.5 text-xs leading-relaxed space-y-2.5 overflow-y-auto flex-1">
          {activeBrowserTab === 'freeform' && (
            <>
              <div className="font-semibold text-slate-100 text-sm">
                Doğrulanmış Android Çoklu Pencere Mimarisi
              </div>
              <p className="text-slate-300">
                Android işletim sisteminde üçüncü taraf bir pencere yöneticisi, diğer uygulamaların pencerelerini iki gerçek mekanizma ile konumlandırabilir:
              </p>
              <div className="p-2.5 rounded bg-slate-900/90 border border-slate-800 space-y-1">
                <div className="font-medium text-blue-400">
                  A) Shizuku / Kablosuz ADB Binder (IActivityTaskManager.resizeTask)
                </div>
                <p className="text-slate-400">
                  Görev sınırlarını (Task Bounds) Activity yeniden başlatılmadan doğrudan WindowManager seviyesinde 90Hz hızında günceller. Şerit kaydırılırken sıfır titreme sağlar.
                </p>
              </div>
              <div className="p-2.5 rounded bg-slate-900/90 border border-slate-800 space-y-1">
                <div className="font-medium text-emerald-400">
                  B) Standart İzin Modu (ActivityOptions.setLaunchBounds)
                </div>
                <p className="text-slate-400">
                  ADB veya Shizuku olmadan çalışır. Hedef uygulamayı{' '}
                  <code className="text-slate-200">FLAG_ACTIVITY_SINGLE_TOP</code> ve yeni{' '}
                  <code className="text-slate-200">Rect(left, top, right, bottom)</code> ile günceller.
                </p>
              </div>
            </>
          )}

          {activeBrowserTab === 'dex_clamping' && (
            <>
              <div className="font-semibold text-slate-100 text-sm">
                Samsung One UI DeX Clamping Sınırı ve Hibrit Park Çözümü
              </div>
              <p className="text-slate-300">
                MacOS üzerinde çalışan ŞeritMac pencereleri ekran dışına (<code className="text-slate-200">x = -1200px</code>) serbestçe itebilir. Ancak Samsung DeX WindowManager, tamamen ekran dışına çıkan pencereleri otomatik olarak görünür alana geri iter.
              </p>
              <p className="text-slate-300">
                <strong>ŞeritDeX Mühendislik Çözümü:</strong> Görünür alandaki (<code className="text-slate-200">0..1920px</code>) pencereler gerçek koordinatlarına yerleştirilirken, şeritte ekran dışına kayan pencereler 24px kenar park yuvasına alınır ve üstteki Compose Şerit Haritası üzerinden kesintisiz temsil edilir.
              </p>
            </>
          )}

          {activeBrowserTab === 'input' && (
            <>
              <div className="font-semibold text-slate-100 text-sm">
                Çoklu Giriş Ergonomisi (Dokunmatik, Klavye, Fare & Touchpad)
              </div>
              <ul className="space-y-1.5 text-slate-300 list-disc pl-4">
                <li>
                  <strong>Dokunmatik (Touch):</strong> Üst 36dp Şerit Haritası üzerinde tek parmakla yatay kaydırma (Scrubbing) ve pencere başlığındaki 44dp genişlik butonları.
                </li>
                <li>
                  <strong>Klavye (Book Cover):</strong> <code className="text-slate-200">Alt + [ / ]</code> odak geçişi, <code className="text-slate-200">Alt + R</code> genişlik döngüsü, <code className="text-slate-200">Alt + G</code> dikey gruplama.
                </li>
                <li>
                  <strong>Fare & Touchpad:</strong> İki parmak yatay kaydırma veya <code className="text-slate-200">Shift + Tekerlek</code> ile pürüzsüz şerit hareketi.
                </li>
              </ul>
            </>
          )}
        </div>
      </div>
    );
  }

  if (win.id === 'win-files') {
    return (
      <div className="flex flex-col h-full bg-slate-950 text-slate-200 p-3 text-xs">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px]">
            <FolderOpen className="w-3.5 h-3.5 text-violet-400" />
            <span>/sdcard/SeritDeX-TabA11Plus</span>
          </div>
          <button
            type="button"
            onClick={onTriggerExportProject}
            className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3 h-3" />
            Kurulum Betiğini İndir
          </button>
        </div>
        <div className="space-y-1.5 overflow-y-auto flex-1">
          {[
            { name: 'StripLayoutEngine.kt', size: '7.4 KB', type: 'Kotlin Çekirdek' },
            { name: 'DexAccessibilityService.kt', size: '6.1 KB', type: 'Sistem Servisi' },
            { name: 'DexWindowController.kt', size: '5.3 KB', type: 'Shizuku + LaunchBounds' },
            { name: 'StripHudCompose.kt', size: '6.8 KB', type: 'Compose Overlay' },
            { name: 'AndroidManifest.xml', size: '3.2 KB', type: 'DeX Yapılandırması' },
          ].map((f) => (
            <div
              key={f.name}
              className="flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-900/80 border border-slate-800/80"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileCode className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                <span className="font-mono text-[11px] text-slate-200 truncate">{f.name}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0 font-mono tabular-nums">
                <span>{f.type}</span>
                <span>·</span>
                <span>{f.size}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (win.id === 'win-inspector') {
    return (
      <div className="flex flex-col h-full bg-slate-950 text-slate-200 p-3 text-xs">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
          <div className="flex items-center gap-1.5 text-cyan-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Canlı Android Rect & Görev Sınırları</span>
          </div>
          <span className="font-mono tabular-nums text-[11px] text-slate-400">
            RAM: {layout.estimatedOverlayRamMb} MB
          </span>
        </div>
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse font-mono tabular-nums text-[11px]">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-1 pr-2">Görev</th>
                <th className="py-1 px-2">DeX Rect(L,T,R,B)</th>
                <th className="py-1 pl-2 text-right">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {layout.placements.map((p) => {
                const w = allWindows[p.windowId];
                if (!w) return null;
                return (
                  <tr
                    key={p.windowId}
                    onClick={() => onFocusWindow(p.windowId)}
                    className={`cursor-pointer transition-colors ${
                      p.isFocused ? 'bg-blue-950/40 text-blue-300' : 'hover:bg-slate-900/60 text-slate-300'
                    }`}
                  >
                    <td className="py-1.5 pr-2 truncate max-w-[110px]">
                      #{w.taskId} {w.title.split(' ')[0]}
                    </td>
                    <td className="py-1.5 px-2 text-slate-300">
                      [{p.dexAppliedRect.left}, {p.dexAppliedRect.top}, {p.dexAppliedRect.right},{' '}
                      {p.dexAppliedRect.bottom}]
                    </td>
                    <td className="py-1.5 pl-2 text-right">
                      {p.visibilityState === 'fully_visible'
                        ? 'Görünür'
                        : p.visibilityState === 'partially_visible'
                        ? 'Kısmi'
                        : 'Kenar Park'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Default / Media window
  return (
    <div className="flex flex-col justify-between h-full bg-slate-950 text-slate-200 p-3.5 text-xs">
      <div className="space-y-1">
        <div className="text-pink-400 font-medium flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5" />
          <span>DeX Odak Ses Motoru (Dolby Atmos Tab A11+)</span>
        </div>
        <div className="text-slate-300 font-semibold text-sm">
          Derin Çalışma Frekansı — 40Hz Gamma Akışı
        </div>
        <div className="text-slate-400 text-[11px]">
          Arka plan ses odak kilidi (AudioFocusRequest.Builder) aktif
        </div>
      </div>

      <div className="space-y-2 my-2">
        <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-400">
          <span>18:42</span>
          <span>{mediaProgress}%</span>
          <span>45:00</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={mediaProgress}
          onChange={(e) => setMediaProgress(Number(e.target.value))}
          aria-label="Medya ilerleme çubuğu"
          className="w-full accent-pink-500 cursor-pointer"
        />
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
        <button
          type="button"
          onClick={() => setIsPlayingMedia((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-pink-600 hover:bg-pink-500 text-white font-medium text-xs transition-colors whitespace-nowrap shrink-0"
        >
          {isPlayingMedia ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {isPlayingMedia ? 'Duraklat' : 'Oynat'}
        </button>
        <button
          type="button"
          onClick={() => setMediaProgress((p) => (p + 15) % 100)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors whitespace-nowrap shrink-0"
        >
          <SkipForward className="w-3.5 h-3.5" />
          Sonraki Frekans
        </button>
      </div>
    </div>
  );
};
