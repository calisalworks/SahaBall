import React, { useState } from 'react';
import { ArrowLeft, Gamepad2, HelpCircle, PlayCircle, Sliders, Volume2, VolumeX } from 'lucide-react';
import type { ControlsLayoutConfig } from '../game/controlsLayout';
import { ControlLayoutEditor } from './ControlLayoutEditor';

interface SettingsModalProps {
  open: boolean;
  isMuted: boolean;
  controlsLayout: ControlsLayoutConfig;
  onToggleMute: () => void;
  onChangeControlsLayout: (next: ControlsLayoutConfig) => void;
  onStartTutorial: () => void;
  onClose: () => void;
}

type SettingsTab = 'sound' | 'controls' | 'howto';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  isMuted,
  controlsLayout,
  onToggleMute,
  onChangeControlsLayout,
  onStartTutorial,
  onClose,
}) => {
  const [tab, setTab] = useState<SettingsTab>('sound');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 w-full h-full overflow-hidden bg-[#FAF4E8] text-[#0B2545] flex flex-col justify-between pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:p-5 select-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#E5DEC9] shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-4 rounded-xl bg-[#0B2545] hover:bg-[#143766] border border-[#1E4A82] text-white text-xs sm:text-sm font-display font-extrabold flex items-center gap-1.5 shadow-[0_2px_0_#06162B] active:translate-y-0.5 transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            <span>Geri</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-white border border-[#E5DEC9] text-[#0B2545] hidden sm:flex items-center justify-center shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <h2 className="font-display font-extrabold text-base sm:text-lg">Ayarlar</h2>
          </div>
        </div>

        {/* Strictly 3 Settings Sections: Oyun Sesi, Kontroller, Nasıl Oynanır */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white border border-[#E5DEC9]">
          <button
            type="button"
            onClick={() => setTab('sound')}
            className={`min-h-[34px] px-2.5 sm:px-3.5 rounded-lg text-xs font-display font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'sound' ? 'bg-[#0B2545] text-white shadow-xs' : 'text-slate-600'
            }`}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>Oyun Sesi</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('controls')}
            className={`min-h-[34px] px-2.5 sm:px-3.5 rounded-lg text-xs font-display font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'controls' ? 'bg-[#0B2545] text-white shadow-xs' : 'text-slate-600'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>Kontroller</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('howto')}
            className={`min-h-[34px] px-2.5 sm:px-3.5 rounded-lg text-xs font-display font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'howto' ? 'bg-[#0B2545] text-white shadow-xs' : 'text-slate-600'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Nasıl Oynanır</span>
          </button>
        </div>
      </div>

      {/* Fullscreen Zero-Scroll Body */}
      <div className="flex-1 min-h-0 py-3 flex flex-col overflow-hidden">
        {tab === 'sound' && (
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <div className="w-full max-w-xl p-5 sm:p-7 rounded-3xl bg-white border border-[#E5DEC9] shadow-sm flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#FAF4E8] border border-[#E5DEC9] flex items-center justify-center text-[#0B2545] shrink-0">
                  {isMuted ? (
                    <VolumeX className="w-7 h-7 text-slate-400" />
                  ) : (
                    <Volume2 className="w-7 h-7 text-[#118C4F]" />
                  )}
                </div>
                <div>
                  <div className="font-display font-extrabold text-base sm:text-lg text-[#0B2545]">
                    Oyun Ses Efektleri
                  </div>
                  <div className="text-xs sm:text-sm text-slate-600 mt-0.5">
                    Top vuruşları, hakem düdüğü, gol sevinci ve tribün sesleri
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleMute}
                className={`min-h-[44px] px-5 rounded-xl text-sm font-display font-extrabold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isMuted
                    ? 'bg-slate-200 border-slate-300 text-slate-700'
                    : 'bg-[#118C4F] border-[#0D6E3E] text-white shadow-xs'
                }`}
              >
                {isMuted ? 'Kapalı' : 'Açık'}
              </button>
            </div>
          </div>
        )}

        {tab === 'controls' && (
          <div className="flex-1 min-h-0 p-3 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-center overflow-hidden">
            <ControlLayoutEditor layout={controlsLayout} onChange={onChangeControlsLayout} />
          </div>
        )}

        {tab === 'howto' && (
          <div className="flex-1 min-h-0 flex flex-col justify-between gap-3 overflow-hidden">
            <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E5DEC9] flex flex-col justify-between gap-2">
                <div>
                  <div className="font-display font-extrabold text-sm sm:text-base text-[#0B2545]">
                    Mobil Dokunmatik
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                    Sol analog joystick ile oyuncunu her yöne hareket ettir. Sağ taraftaki Sprint butonuyla hızlan, Şut butonuyla topa vur.
                  </p>
                </div>
                <div className="text-[11px] font-semibold text-[#118C4F]">
                  Kontroller sekmesinden buton boyut ve konumlarını özelleştirebilirsin.
                </div>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E5DEC9] flex flex-col justify-between gap-2">
                <div>
                  <div className="font-display font-extrabold text-sm sm:text-base text-[#0B2545]">
                    Klavye (PC) &amp; Taktik
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                    WASD veya Ok Tuşları ile koş, Shift ile Sprint yap, Boşluk (Space) tuşuyla şut çek.
                  </p>
                </div>
                <div className="text-[11px] font-semibold text-slate-600">
                  Sol üstteki taktik barından Defansif / Dengeli / Ofansif seçimi yapabilir, saha çizgisinin 1 karakter boyu dışına çıkabilirsin.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onStartTutorial();
              }}
              className="w-full min-h-[48px] rounded-xl bg-[#118C4F] hover:bg-[#0E7943] text-white font-display font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-[0_3px_0_#0A5D33] active:translate-y-0.5 transition-all shrink-0 whitespace-nowrap cursor-pointer"
            >
              <PlayCircle className="w-5 h-5" />
              <span>İnteraktif Eğitimi Başlat</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
