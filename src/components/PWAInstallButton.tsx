import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        title="Uygulamayı Ana Ekrana / Tam Ekran Kur"
        className="min-h-[40px] sm:min-h-[44px] px-3 rounded-xl bg-[#118C4F] hover:bg-[#0E7943] text-white text-xs font-display font-bold flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline">Uygulamayı Kur</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          title="Ana Ekrana Ekle"
          className="min-h-[40px] sm:min-h-[44px] px-3 rounded-xl bg-white/90 hover:bg-white border border-[#E5DEC9] text-[#0D2545] text-xs font-display font-bold flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4 text-[#118C4F] shrink-0" />
          <span className="hidden sm:inline">Ana Ekrana Ekle</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white border border-[#E5DEC9] p-5 text-[#0D2545] shadow-2xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-extrabold text-base">Tam Ekran Kurulum (iOS)</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Kapat"
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Bildirim ve tarayıcı çubukları olmadan tam ekran oynamak için:
                <br />
                1. Safari alt menüsünden <Share className="inline w-3.5 h-3.5 mx-0.5 text-[#0B2545]" />{' '}
                <strong>Paylaş</strong> simgesine dokun.
                <br />
                2. <strong>Ana Ekrana Ekle</strong> seçeneğine bas.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full min-h-[40px] rounded-xl bg-[#0B2545] text-white font-display font-bold text-xs"
              >
                Tamam
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
