import React, { useState } from 'react';
import {
  KOTLIN_PROJECT_FILES,
  KotlinSourceFile,
} from '../data/kotlinProjectFiles';
import {
  FileCode,
  Download,
  Copy,
  Check,
  Terminal,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';

interface KotlinSourceExplorerProps {
  onDownloadBundle: () => void;
}

export const KotlinSourceExplorer: React.FC<KotlinSourceExplorerProps> = ({
  onDownloadBundle,
}) => {
  const [selectedFileId, setSelectedFileId] = useState<string>(KOTLIN_PROJECT_FILES[0].id);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredFiles =
    categoryFilter === 'ALL'
      ? KOTLIN_PROJECT_FILES
      : KOTLIN_PROJECT_FILES.filter((f) => f.category === categoryFilter);

  const activeFile: KotlinSourceFile =
    KOTLIN_PROJECT_FILES.find((f) => f.id === selectedFileId) || KOTLIN_PROJECT_FILES[0];

  const handleCopyFile = (file: KotlinSourceFile) => {
    navigator.clipboard?.writeText(file.content);
    setCopiedId(file.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Header & Download CTA */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-800">
        <div className="space-y-2 max-w-2xl">
          <div className="text-xs font-medium text-blue-400">
            Kotlin 2.0 + Jetpack Compose + Shizuku / ActivityOptions
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
            Tam Yerel Android Studio Projesi ve Kurulabilir APK Üreticisi
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Galaxy Tab A11+ (ARM64-v8a, Android 14/15, One UI DeX) üzerinde doğrudan derlenip kurulabilen, sıfır çöp üretimi (zero-allocation) prensibiyle yazılmış eksiksiz Kotlin kaynak kodları.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onDownloadBundle}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            Tüm Android Projesini İndir (.sh Kurucu)
          </button>
        </div>
      </div>

      {/* Category Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
          {[
            { id: 'ALL', label: 'Tüm Dosyalar (6)' },
            { id: 'Core Engine', label: 'Çekirdek Motor' },
            { id: 'System Services', label: 'Sistem Servisleri' },
            { id: 'Compose UI & HUD', label: 'Jetpack Compose HUD' },
            { id: 'Build & Manifest', label: 'Manifest & APK Derleyici' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategoryFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                categoryFilter === tab.id
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-400 font-mono tabular-nums">
          Hedef Mimari: arm64-v8a · MinSDK: 29 · TargetSDK: 35 · R8 Tam Optimizasyon
        </div>
      </div>

      {/* Explorer Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left File Tree */}
        <div className="lg:col-span-4 space-y-2">
          {filteredFiles.map((file) => {
            const isSelected = file.id === activeFile.id;
            return (
              <button
                key={file.id}
                type="button"
                onClick={() => setSelectedFileId(file.id)}
                className={`w-full text-left p-3.5 rounded-lg border transition-colors ${
                  isSelected
                    ? 'bg-slate-900 border-blue-500/60 text-slate-100'
                    : 'bg-slate-900/40 border-slate-800/80 text-slate-300 hover:bg-slate-900/80'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileCode
                      className={`w-4 h-4 shrink-0 ${
                        isSelected ? 'text-blue-400' : 'text-slate-400'
                      }`}
                    />
                    <span className="font-mono text-xs font-semibold truncate">
                      {file.title}
                    </span>
                  </div>
                  <span className="font-mono tabular-nums text-[11px] text-slate-400 shrink-0">
                    {file.linesOfCode} satır
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-400 font-mono truncate">
                  {file.path}
                </div>
                <p className="mt-1.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {file.summary}
                </p>
              </button>
            );
          })}

          {/* Galaxy Tab A11+ APK Installation Steps */}
          <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800 space-y-3 mt-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>Galaxy Tab A11+ DeX Kurulum Adımları</span>
            </div>
            <ol className="space-y-2 text-xs text-slate-400 list-decimal pl-4 leading-relaxed">
              <li>
                İndirilen <code className="text-slate-200">seritdex-tab-a11plus-installer.sh</code> betiğini çalıştırın ve <code className="text-slate-200">./gradlew assembleRelease</code> ile APK’yı derleyin.
              </li>
              <li>
                APK’yı Galaxy Tab A11+ cihazınıza kurun ve <strong>Ayarlar → Erişilebilirlik → Yüklü Uygulamalar → ŞeritDeX Pencere Motoru</strong> servisini etkinleştirin.
              </li>
              <li>
                90Hz sıfır titremeli kaydırma için (isteğe bağlı) <strong>Shizuku</strong> uygulamasını Kablosuz Hata Ayıklama ile başlatıp ŞeritDeX’e izin verin.
              </li>
            </ol>
          </div>
        </div>

        {/* Right Code Viewer */}
        <div className="lg:col-span-8 rounded-lg border border-slate-800 bg-[#080C14] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800">
            <div className="min-w-0">
              <div className="font-mono text-xs font-semibold text-slate-100 truncate">
                {activeFile.path}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                {activeFile.summary}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleCopyFile(activeFile)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
            >
              {copiedId === activeFile.id ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Kopyalandı
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Kodu Kopyala
                </>
              )}
            </button>
          </div>

          <div className="p-4 overflow-x-auto max-h-[640px] overflow-y-auto">
            <pre className="font-mono text-xs leading-relaxed text-slate-200 tabular-nums">
              <code>{activeFile.content}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
