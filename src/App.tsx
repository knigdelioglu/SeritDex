/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { createInitialWorkspaceState } from './data/dexSeedWorkspace';
import {
  computeStripLayout,
  ExecutionBackend,
  StripWorkspaceState,
} from './engine/stripLayoutEngine';
import { generateProjectExportScript } from './data/kotlinProjectFiles';
import { DexLiveStripWorkspace } from './components/DexLiveStripWorkspace';
import { ArchitectureAndDexMatrix } from './components/ArchitectureAndDexMatrix';
import { KotlinSourceExplorer } from './components/KotlinSourceExplorer';

type ActiveSection = 'workspace' | 'architecture' | 'kotlin_code';

export default function App() {
  const [workspaceState, setWorkspaceState] = useState<StripWorkspaceState>(() =>
    createInitialWorkspaceState()
  );
  const [activeSection, setActiveSection] = useState<ActiveSection>('workspace');
  const [downloadBanner, setDownloadBanner] = useState<string | null>(null);

  const layout = computeStripLayout(workspaceState);

  const handleDownloadAndroidBundle = () => {
    const scriptContent = generateProjectExportScript();
    const blob = new Blob([scriptContent], { type: 'text/x-shellscript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'seritdex-tab-a11plus-installer.sh';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadBanner(
      'seritdex-tab-a11plus-installer.sh indirildi. Çalıştırıp "./gradlew assembleRelease" ile APK derleyebilirsiniz.'
    );
    setTimeout(() => setDownloadBanner(null), 5000);
  };

  const handleSetExecutionBackend = (backend: ExecutionBackend) => {
    setWorkspaceState((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        executionBackend: backend,
      },
    }));
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0F17] text-slate-100">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-800/90 bg-[#0B0F17]/95 sticky top-0 z-40">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#workspace"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('workspace');
          }}
          className="text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
        >
          ŞeritDeX
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-400">
          <a
            href="#workspace"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('workspace');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 hover:underline underline-offset-4 ${
              activeSection === 'workspace' ? 'text-white font-semibold' : 'hover:text-slate-200'
            }`}
          >
            Canlı Çalışma Alanı
          </a>
          <a
            href="#architecture"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('architecture');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 hover:underline underline-offset-4 ${
              activeSection === 'architecture' ? 'text-white font-semibold' : 'hover:text-slate-200'
            }`}
          >
            DeX Mimarisi
          </a>
          <a
            href="#kotlin-code"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('kotlin_code');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 hover:underline underline-offset-4 ${
              activeSection === 'kotlin_code' ? 'text-white font-semibold' : 'hover:text-slate-200'
            }`}
          >
            Kotlin Kaynak Kodu
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleDownloadAndroidBundle}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0"
          >
            APK Projesini İndir
          </button>
        </div>
      </header>

      {/* Optional Download Confirmation Toast */}
      {downloadBanner && (
        <div className="bg-blue-950/90 border-b border-blue-800 px-6 py-2 text-xs text-blue-200 flex items-center justify-between">
          <span>{downloadBanner}</span>
          <button
            type="button"
            onClick={() => setDownloadBanner(null)}
            className="text-blue-300 hover:text-white font-medium ml-4"
          >
            Kapat
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1">
        {activeSection === 'workspace' && (
          <DexLiveStripWorkspace
            state={workspaceState}
            setState={setWorkspaceState}
            onTriggerExportProject={handleDownloadAndroidBundle}
          />
        )}

        {activeSection === 'architecture' && (
          <ArchitectureAndDexMatrix
            activeBackend={workspaceState.config.executionBackend}
            onSelectBackend={handleSetExecutionBackend}
            estimatedRamMb={layout.estimatedOverlayRamMb}
          />
        )}

        {activeSection === 'kotlin_code' && (
          <KotlinSourceExplorer onDownloadBundle={handleDownloadAndroidBundle} />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-800/80 px-6 py-4 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div>
          ŞeritDeX · Samsung Galaxy Tab A11+ (WUXGA 1920×1200 90Hz) Yatay Pencere Yöneticisi
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setActiveSection('workspace')}
            className="hover:text-slate-200 transition-colors"
          >
            Çalışma Alanı
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={() => setActiveSection('architecture')}
            className="hover:text-slate-200 transition-colors"
          >
            Mimari Doğrulama
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={() => setActiveSection('kotlin_code')}
            className="hover:text-slate-200 transition-colors"
          >
            Kotlin & Compose Paketi
          </button>
        </div>
      </footer>
    </div>
  );
}
