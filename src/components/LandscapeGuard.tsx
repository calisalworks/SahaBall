import React, { useEffect, useState } from 'react';
import { Maximize, RotateCw, Smartphone } from 'lucide-react';

interface LandscapeGuardProps {
  onEnterLandscapeFullscreen: () => void | Promise<void>;
}

export const LandscapeGuard: React.FC<LandscapeGuardProps> = ({
  onEnterLandscapeFullscreen,
}) => {
  const [isPortrait, setIsPortrait] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerHeight > window.innerWidth;
  });

  useEffect(() => {
    const check = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  if (!isPortrait) return null;

  return (
    <div className="fixed inset-0 z-[100] w-full h-full bg-[#092038] text-white flex flex-col items-center justify-center p-6 text-center select-none touch-none">
      <div className="relative mb-5 flex items-center justify-center">
        <div className="w-20 h-20 rounded-3xl bg-[#118C4F]/20 border-2 border-[#118C4F] flex items-center justify-center shadow-2xl">
          <Smartphone className="w-10 h-10 text-emerald-300 -rotate-90 transition-transform" />
        </div>
        <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-md">
          <RotateCw className="w-4 h-4" />
        </div>
      </div>

      <h2 className="font-display font-extrabold text-2xl tracking-tight text-white">
        Yatay Tam Ekran Gerekli
      </h2>
      <p className="mt-2 max-w-xs text-sm text-slate-300 leading-relaxed">
        SahaBall yalnızca <strong>yatay tam ekran</strong> modunda oynanır. Üst ve alt sistem çubuklarını gizlemek için cihazını yan çevir veya aşağıdaki butona dokun.
      </p>

      <button
        type="button"
        onClick={() => {
          void onEnterLandscapeFullscreen();
        }}
        className="mt-6 min-h-[48px] px-6 rounded-2xl bg-[#118C4F] hover:bg-[#0E7943] active:translate-y-0.5 text-white font-display font-extrabold text-sm flex items-center justify-center gap-2 shadow-[0_4px_0_#0A5D33] transition-all cursor-pointer"
      >
        <Maximize className="w-4 h-4" />
        <span>Yatay Tam Ekrana Geç</span>
      </button>
    </div>
  );
};
