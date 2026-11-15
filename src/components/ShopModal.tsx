import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, ShoppingBag } from 'lucide-react';
import { getBallPreviewUrl, preloadAllBallSprites, subscribeBallSprites } from '../game/ballSprites';
import {
  getJerseyPreviewUrl,
  preloadAllJerseySprites,
  subscribeJerseySprites,
} from '../game/jerseySprites';
import { SHOP_ITEMS } from '../game/shop';
import type { BallSkinId, EquippedSkins, JerseySkinId, ShopCategory, ShopItem } from '../game/shop';

interface ShopModalProps {
  open: boolean;
  coins: number;
  ownedIds: string[];
  equipped: EquippedSkins;
  onBuy: (item: ShopItem) => void;
  onEquip: (category: ShopCategory, skinId: string) => void;
  onClose: () => void;
}

const TABS: Array<{ id: ShopCategory; label: string }> = [
  { id: 'ball', label: 'Toplar' },
  { id: 'pitch', label: 'Sahalar' },
  { id: 'jersey', label: 'Formalar' },
];

export const ShopModal: React.FC<ShopModalProps> = ({
  open,
  coins,
  ownedIds,
  equipped,
  onBuy,
  onEquip,
  onClose,
}) => {
  const [tab, setTab] = useState<ShopCategory>('ball');
  const [, setSpriteTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    preloadAllBallSprites();
    preloadAllJerseySprites();
    const unsubBall = subscribeBallSprites(() => setSpriteTick((t) => t + 1));
    const unsubJersey = subscribeJerseySprites(() => setSpriteTick((t) => t + 1));
    return () => {
      unsubBall();
      unsubJersey();
    };
  }, [open]);

  if (!open) return null;

  const items = SHOP_ITEMS.filter((it) => it.category === tab);
  const currentEquipped = equipped[tab];

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
            <div className="w-9 h-9 rounded-xl bg-[#0B2545] text-white hidden sm:flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <h2 className="font-display font-extrabold text-base sm:text-lg">Mağaza</h2>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white border border-[#E5DEC9]">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-display font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  tab === t.id ? 'bg-[#0B2545] text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={currentEquipped === 'default'}
            onClick={() => onEquip(tab, 'default')}
            className={`min-h-[38px] px-3 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              currentEquipped === 'default'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-white border-[#DFCCA8] text-[#0B2545] hover:bg-[#F3E9D2]'
            }`}
          >
            {tab === 'ball' && (
              <img
                src={getBallPreviewUrl('default')}
                alt="Varsayılan Top"
                referrerPolicy="no-referrer"
                className="w-4 h-4 rounded-full object-cover shrink-0"
              />
            )}
            {tab === 'jersey' && (
              <img
                src={getJerseyPreviewUrl('default')}
                alt="Varsayılan Forma"
                referrerPolicy="no-referrer"
                className="w-4 h-4 rounded-md object-contain shrink-0"
              />
            )}
            <span>{currentEquipped === 'default' ? 'Varsayılan Seçili' : 'Varsayılana Dön'}</span>
          </button>

          <div className="flex items-center gap-1.5 font-display font-bold text-sm text-[#0B2545] bg-white border border-[#E5DEC9] px-3 py-1.5 rounded-xl tabular-nums shrink-0">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 border border-amber-600/50 text-[9px] font-extrabold text-amber-950">
              J
            </span>
            <span>{coins.toLocaleString('en-US')}</span>
          </div>
        </div>
      </div>

      {/* Fullscreen Item Cards — Zero Scroll */}
      <div
        className={`flex-1 min-h-0 py-3 grid gap-3 sm:gap-4 items-stretch overflow-hidden ${
          items.length >= 3 ? 'grid-cols-1 min-[520px]:grid-cols-3' : 'grid-cols-1 min-[520px]:grid-cols-2'
        }`}
      >
        {items.map((item) => {
          const isOwned = ownedIds.includes(item.id);
          const isEquipped = currentEquipped === item.skinId;
          const canAfford = coins >= item.price;

          return (
            <div
              key={item.id}
              className={`p-4 sm:p-5 rounded-2xl border-2 flex flex-col justify-between gap-3 transition-all ${
                isEquipped
                  ? 'bg-emerald-50/90 border-emerald-500'
                  : 'bg-white border-[#E5DEC9]'
              }`}
            >
              <div className="flex flex-col items-center text-center gap-2.5 my-auto">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#FAF4E8] border border-[#DFCCA8] flex items-center justify-center shrink-0 shadow-xs">
                  <ItemPreview item={item} />
                </div>

                <div className="min-w-0">
                  <h3 className="font-display font-extrabold text-sm sm:text-base text-[#0B2545]">
                    {item.name}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-snug line-clamp-2">
                    {item.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 shrink-0">
                <div className="flex items-center gap-1.5 font-display font-bold text-sm text-amber-800 shrink-0 tabular-nums">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 text-[10px] font-extrabold text-amber-950">
                    J
                  </span>
                  <span>{item.price}</span>
                </div>

                {isEquipped ? (
                  <span className="min-h-[38px] px-3.5 rounded-xl bg-emerald-600 text-white text-xs font-display font-bold flex items-center gap-1 shrink-0 whitespace-nowrap">
                    <Check className="w-3.5 h-3.5" />
                    Seçili
                  </span>
                ) : isOwned ? (
                  <button
                    type="button"
                    onClick={() => onEquip(item.category, item.skinId)}
                    className="min-h-[38px] px-4 rounded-xl bg-[#0B2545] hover:bg-[#143766] text-white text-xs font-display font-bold transition-colors shrink-0 whitespace-nowrap cursor-pointer"
                  >
                    Kullan
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => onBuy(item)}
                    className="min-h-[38px] px-4 rounded-xl bg-[#118C4F] hover:bg-[#0E7943] disabled:bg-slate-300 disabled:text-slate-500 text-white text-xs font-display font-bold transition-colors shrink-0 whitespace-nowrap cursor-pointer"
                  >
                    {canAfford ? 'Satın Al' : 'Yetersiz Jeton'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ItemPreview: React.FC<{ item: ShopItem }> = ({ item }) => {
  if (item.category === 'ball') {
    return (
      <img
        src={getBallPreviewUrl(item.skinId as BallSkinId)}
        alt={item.name}
        referrerPolicy="no-referrer"
        className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover drop-shadow-sm"
      />
    );
  }
  if (item.category === 'pitch') {
    return (
      <svg width="64" height="48" viewBox="0 0 42 32" aria-hidden="true">
        <rect x="2" y="2" width="38" height="28" rx="4" fill={item.previewPrimary} />
        <rect x="10" y="2" width="8" height="28" fill={item.previewSecondary} opacity="0.55" />
        <rect x="26" y="2" width="8" height="28" fill={item.previewSecondary} opacity="0.55" />
        <rect x="2" y="2" width="38" height="28" rx="4" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
        <line x1="21" y1="2" x2="21" y2="30" stroke="#FFFFFF" strokeWidth="1.2" />
        <circle cx="21" cy="16" r="4.5" fill="none" stroke="#FFFFFF" strokeWidth="1.2" />
      </svg>
    );
  }
  return (
    <img
      src={getJerseyPreviewUrl(item.skinId as JerseySkinId)}
      alt={item.name}
      referrerPolicy="no-referrer"
      className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-contain drop-shadow-sm"
    />
  );
};
