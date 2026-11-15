export type BallSkinId = 'default' | 'gold' | 'crimson' | 'sapphire';
export type PitchSkinId = 'default' | 'emerald' | 'night';
export type JerseySkinId = 'default' | 'gold_trim' | 'bolt';

export interface EquippedSkins {
  ball: BallSkinId;
  pitch: PitchSkinId;
  jersey: JerseySkinId;
}

export type ShopCategory = 'ball' | 'pitch' | 'jersey';

export interface ShopItem {
  id: string;
  skinId: BallSkinId | PitchSkinId | JerseySkinId;
  category: ShopCategory;
  name: string;
  description: string;
  price: number;
  previewPrimary: string;
  previewSecondary: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  // 3 Realistic Balls
  {
    id: 'ball_gold',
    skinId: 'gold',
    category: 'ball',
    name: 'Altın Şampiyon Topu',
    description: 'Parlak altın ve lacivert panelli özel maç topu.',
    price: 350,
    previewPrimary: '#FACC15',
    previewSecondary: '#0F172A',
  },
  {
    id: 'ball_sapphire',
    skinId: 'sapphire',
    category: 'ball',
    name: 'Safir Yıldız Maç Topu',
    description: 'Metalik safir yıldız panelli FIFA stili profesyonel maç topu.',
    price: 480,
    previewPrimary: '#1D4ED8',
    previewSecondary: '#F8FAFC',
  },
  {
    id: 'ball_crimson',
    skinId: 'crimson',
    category: 'ball',
    name: 'Kızıl Yıldırım Topu',
    description: 'Yüksek kontrastlı kırmızı-beyaz hızlı top.',
    price: 600,
    previewPrimary: '#EF4444',
    previewSecondary: '#FFFFFF',
  },
  // 2 Pitches
  {
    id: 'pitch_emerald',
    skinId: 'emerald',
    category: 'pitch',
    name: 'Zümrüt Stadyum',
    description: 'Canlı zümrüt çim şeritleri ve parlak beyaz çizgiler.',
    price: 450,
    previewPrimary: '#059669',
    previewSecondary: '#10B981',
  },
  {
    id: 'pitch_night',
    skinId: 'night',
    category: 'pitch',
    name: 'Gece Arenası',
    description: 'Koyu gece çimi üzerinde yüksek kontrastlı nane çizgiler.',
    price: 750,
    previewPrimary: '#0F2E28',
    previewSecondary: '#34D399',
  },
  // 2 Realistic Jerseys
  {
    id: 'jersey_gold_trim',
    skinId: 'gold_trim',
    category: 'jersey',
    name: 'Altın Şerit Forma',
    description: 'Gerçekçi dokuma kumaş, altın çift şerit ve arma detaylı pro forma.',
    price: 300,
    previewPrimary: '#FBBF24',
    previewSecondary: '#FEF3C7',
  },
  {
    id: 'jersey_bolt',
    skinId: 'bolt',
    category: 'jersey',
    name: 'Şimşek Arma Forma',
    description: 'Çapraz şimşek dokulu modern atletik maç forması.',
    price: 550,
    previewPrimary: '#38BDF8',
    previewSecondary: '#FFFFFF',
  },
];

export const DEFAULT_SKINS: EquippedSkins = {
  ball: 'default',
  pitch: 'default',
  jersey: 'default',
};
