import React, { useState } from 'react';
import {
  Cpu,
  Layers,
  ShieldCheck,
  Smartphone,
  Keyboard,
  MousePointer,
  Hand,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { ExecutionBackend } from '../engine/stripLayoutEngine';

interface ArchitectureAndDexMatrixProps {
  activeBackend: ExecutionBackend;
  onSelectBackend: (backend: ExecutionBackend) => void;
  estimatedRamMb: number;
}

export const ArchitectureAndDexMatrix: React.FC<ArchitectureAndDexMatrixProps> = ({
  activeBackend,
  onSelectBackend,
  estimatedRamMb,
}) => {
  const [selectedInputTab, setSelectedInputTab] = useState<'touch' | 'keyboard' | 'mouse'>('touch');

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-10">
      {/* Header & Backend Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-800">
        <div className="space-y-2 max-w-2xl">
          <div className="text-xs font-medium text-blue-400">
            01. Android 14/15 & One UI DeX Sistem Mimarisi
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
            Samsung Galaxy Tab A11+ Teknik Sınır Doğrulaması ve Çözüm Mimarisi
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            macOS üzerindeki ŞeritMac yaklaşımını birebir kopyalamak yerine, Android’in güvenlik modeli ve Samsung DeX’in{' '}
            <code className="text-slate-200 font-mono">WindowManager</code> kurallarına özgü çift katmanlı bir yerel pencere motoru tasarlandı.
          </p>
        </div>

        <div className="flex flex-col gap-1.5 shrink-0">
          <span className="text-xs text-slate-400">Çalışma Zamanı Pencere Köprüsü Seçimi:</span>
          <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => onSelectBackend('shizuku_binder')}
              className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeBackend === 'shizuku_binder'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Shizuku IActivityTaskManager (90Hz)
            </button>
            <button
              type="button"
              onClick={() => onSelectBackend('standard_launch_bounds')}
              className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeBackend === 'standard_launch_bounds'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Standart ActivityOptions (ADB Yok)
            </button>
          </div>
        </div>
      </div>

      {/* Technical Capability Comparison Table */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">
          02. Doğrulanmış Android Pencere Yönetimi Yetenek Matrisi
        </h3>
        <div className="overflow-x-auto border border-slate-800 rounded-lg bg-slate-900/50">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/90">
                <th className="py-3 px-4 font-semibold">Yetenek / Sistem Özelliği</th>
                <th className="py-3 px-4 font-semibold">Standart İzin Modu (ADB/Root Yok)</th>
                <th className="py-3 px-4 font-semibold">Shizuku / Kablosuz ADB Modu (Önerilen)</th>
                <th className="py-3 px-4 font-semibold">Samsung DeX / One UI Gerçek Sınırı ve Çözüm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              <tr>
                <td className="py-3 px-4 font-medium text-slate-100">
                  Açık Pencereleri Tespit Etme
                </td>
                <td className="py-3 px-4 font-mono text-[11px] text-emerald-400">
                  AccessibilityService.getWindows()
                </td>
                <td className="py-3 px-4 font-mono text-[11px] text-emerald-400">
                  AccessibilityWindowInfo + IActivityTaskManager
                </td>
                <td className="py-3 px-4 text-slate-400">
                  <code className="text-slate-200">FLAG_RETRIEVE_INTERACTIVE_WINDOWS</code> ile tüm Freeform uygulama pencerelerinin anlık <code className="text-slate-200">Rect</code> koordinatları 16ms gecikmeyle okunur.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-slate-100">
                  Pencere Konumlandırma & Boyutlandırma
                </td>
                <td className="py-3 px-4 font-mono text-[11px] text-amber-300">
                  ActivityOptions.setLaunchBounds(Rect)
                </td>
                <td className="py-3 px-4 font-mono text-[11px] text-emerald-400">
                  IActivityTaskManager.resizeTask(id, Rect, 2)
                </td>
                <td className="py-3 px-4 text-slate-400">
                  Standart modda hedef uygulama <code className="text-slate-200">SINGLE_TOP</code> ile yeni koordinata taşınır. Shizuku modunda ise Activity yeniden başlatılmadan 90Hz akıcı kaydırma yapılır.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-slate-100">
                  Ekran Dışı (Off-Screen) Şerit Kaydırma
                </td>
                <td className="py-3 px-4">
                  24px Kenar Park + Üst Şerit Haritası
                </td>
                <td className="py-3 px-4">
                  Kesintisiz Sanal Koordinat + Kenar Park
                </td>
                <td className="py-3 px-4 text-slate-400">
                  One UI DeX, ekran dışına tamamen çıkan pencereleri içeri iter (clamping). ŞeritDeX, görünmeyen pencereleri 24px kenar yuvasında park ederek boyut bozulmasını önler.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-slate-100">
                  Fiziksel Klavye Kısayol Yakalama
                </td>
                <td className="py-3 px-4 font-mono text-[11px] text-emerald-400">
                  onKeyEvent(KeyEvent) [Alt+[, Alt+]]
                </td>
                <td className="py-3 px-4 font-mono text-[11px] text-emerald-400">
                  onKeyEvent(KeyEvent) [Tam Destek]
                </td>
                <td className="py-3 px-4 text-slate-400">
                  DeX’in varsayılan <code className="text-slate-200">Win/Meta</code> kısayollarıyla çakışmamak için <code className="text-slate-200">Alt + [ / ] / R / G / Space</code> tuş dizilimi seçilmiştir.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Three-Column Engineering Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-400">Sıfır Çöp Üretimi (Zero-GC)</span>
            <Cpu className="w-4 h-4 text-blue-400" />
          </div>
          <h4 className="text-base font-semibold text-slate-100">
            Sabit {estimatedRamMb} MB RAM Ayak İzi
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Galaxy Tab A11+ üzerinde arka planda çalışan pencere yöneticisinin pil ve bellek tüketmemesi için <code className="text-slate-200">Rect</code> nesneleri önceden tahsis edilmiş havuzda (object pool) yeniden kullanılır. Yalnızca pencere durumu değiştiğinde yeniden hesaplama yapılır.
          </p>
        </div>

        <div className="p-5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-400">ŞeritMac’in Ötesinde DeX Tasarımı</span>
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <h4 className="text-base font-semibold text-slate-100">
            Dikey Sütun Gruplama & Sabit PIP
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            1920×1200 (16:10) WUXGA ekran oranını en verimli kullanmak için iki pencere tek bir şerit sütununda alt-üst (<code className="text-slate-200">Alt + G</code>) gruplanabilir veya referans penceresi şeritten bağımsız köşeye sabitlenebilir.
          </p>
        </div>

        <div className="p-5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-400">DeX Clamping Koruması</span>
            <ShieldCheck className="w-4 h-4 text-amber-400" />
          </div>
          <h4 className="text-base font-semibold text-slate-100">
            Akıllı Görünür Alan (Viewport) Kilidi
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Samsung DeX’te <code className="text-slate-200">360dp</code> altındaki veya ekran dışındaki pencerelerin zorla yeniden boyutlandırılmasını engellemek için her pencerenin <code className="text-slate-200">stripBounds</code> ve <code className="text-slate-200">dexSafeBounds</code> koordinatları ayrı tutulur.
          </p>
        </div>
      </div>

      {/* Multi-Modal Input Ergonomics Spec */}
      <div className="p-6 rounded-lg bg-slate-900/40 border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              03. Birinci Sınıf Çoklu Giriş (Dokunmatik, Klavye, Fare & Touchpad) Ergonomisi
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Galaxy Tab A11+ hem tablet modunda dokunmatikle hem Book Cover klavye/touchpad ile kullanıldığı için her giriş yöntemi özel olarak optimize edildi.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setSelectedInputTab('touch')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedInputTab === 'touch'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Hand className="w-3.5 h-3.5" />
              Dokunmatik (Touch)
            </button>
            <button
              type="button"
              onClick={() => setSelectedInputTab('keyboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedInputTab === 'keyboard'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              Klavye Kısayolları
            </button>
            <button
              type="button"
              onClick={() => setSelectedInputTab('mouse')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedInputTab === 'mouse'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MousePointer className="w-3.5 h-3.5" />
              Fare & Touchpad
            </button>
          </div>
        </div>

        {selectedInputTab === 'touch' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded bg-slate-950/70 border border-slate-800/80 space-y-1.5">
              <div className="font-semibold text-slate-100">Üst 36dp Şerit Haritası (Scrubber)</div>
              <p className="text-slate-400">
                Uygulama pencerelerinin içindeki kaydırma hareketleriyle çakışmamak için ekranın en üstündeki 36dp’lik şerit haritasında parmağınızı yatay sürükleyerek tüm pencereler arasında 90Hz hızında gezinebilirsiniz.
              </p>
            </div>
            <div className="p-4 rounded bg-slate-950/70 border border-slate-800/80 space-y-1.5">
              <div className="font-semibold text-slate-100">Tek Dokunuş Genişlik & Grup Kontrolleri</div>
              <p className="text-slate-400">
                Köşelerden milimetrik pencere boyutlandırmak dokunmatik ekranda yorucudur. Her pencere başlığında <code className="text-slate-200">1/3</code>, <code className="text-slate-200">1/2</code>, <code className="text-slate-200">2/3</code>, <code className="text-slate-200">Tam</code> ve <code className="text-slate-200">Dikey Grup</code> düğmeleri yer alır.
              </p>
            </div>
            <div className="p-4 rounded bg-slate-950/70 border border-slate-800/80 space-y-1.5">
              <div className="font-semibold text-slate-100">Yay Fiziğiyle Otomatik Hizalama</div>
              <p className="text-slate-400">
                Yatay kaydırma bırakıldığında aktif pencere ekran ortasına veya kenar sınırına <code className="text-slate-200">spring(dampingRatio = 0.86f)</code> eğrisiyle pürüzsüzce oturur.
              </p>
            </div>
          </div>
        )}

        {selectedInputTab === 'keyboard' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
            {[
              { key: 'Alt + [  veya  Alt + ←', desc: 'Şeritte sol pencereye odaklan ve merkeze kaydır' },
              { key: 'Alt + ]  veya  Alt + →', desc: 'Şeritte sağ pencereye odaklan ve merkeze kaydır' },
              { key: 'Alt + Shift + ← / →', desc: 'Aktif pencere sütununu şeritte sola / sağa taşı' },
              { key: 'Alt + R', desc: 'Aktif sütun genişliğini değiştir (1/3 → 1/2 → 2/3 → Tam)' },
              { key: 'Alt + G', desc: 'Aktif pencereyi komşu sütunla dikey grupla / grubu çöz' },
              { key: 'Alt + Space', desc: 'Hızlı Geçiş (Quick Switcher) paletini aç / kapat' },
            ].map((item) => (
              <div
                key={item.key}
                className="p-3.5 rounded bg-slate-950/70 border border-slate-800/80 space-y-1"
              >
                <div className="text-blue-400 font-semibold">{item.key}</div>
                <div className="text-slate-300 font-sans text-[11px]">{item.desc}</div>
              </div>
            ))}
          </div>
        )}

        {selectedInputTab === 'mouse' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded bg-slate-950/70 border border-slate-800/80 space-y-1.5">
              <div className="font-semibold text-slate-100">Yatay Tekerlek & İki Parmak Touchpad</div>
              <p className="text-slate-400">
                Touchpad üzerinde iki parmakla yatay kaydırma veya fare ile <code className="text-slate-200">Shift + Tekerlek</code> hareketi doğrudan şerit kamerasını <code className="text-slate-200">PointerEventType.Scroll</code> üzerinden 90Hz hızda hareket ettirir.
              </p>
            </div>
            <div className="p-4 rounded bg-slate-950/70 border border-slate-800/80 space-y-1.5">
              <div className="font-semibold text-slate-100">Sütun Kenarından Canlı Boyutlandırma</div>
              <p className="text-slate-400">
                Sütunlar arasındaki ayırıcı çizgiyi fareyle sürükleyerek pencere genişliğini serbest oranlarda (<code className="text-slate-200">25% – 100%</code>) kesintisiz ayarlayabilirsiniz.
              </p>
            </div>
            <div className="p-4 rounded bg-slate-950/70 border border-slate-800/80 space-y-1.5">
              <div className="font-semibold text-slate-100">Kısmi Görünür Pencereye Tıklama</div>
              <p className="text-slate-400">
                Ekranın sağ veya sol kenarında kısmen görünen bir pencereye tıklandığında, şerit otomatik olarak o pencereyi görünür merkeze kaydırır.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
