export const CATEGORIES = [
  { id: '식비', name: '식비', icon: 'Utensils', color: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
  { id: '카페/간식', name: '카페/간식', icon: 'Coffee', color: 'bg-stone-100 text-stone-700 border-stone-200' },
  { id: '마트/생필품', name: '마트/생필품', icon: 'ShoppingCart', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { id: '교통', name: '교통', icon: 'Car', color: 'bg-blue-50 text-blue-800 border-blue-100' },
  { id: '쇼핑', name: '쇼핑', icon: 'ShoppingBag', color: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
  { id: '문화/여가', name: '문화/여가', icon: 'Film', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { id: '의료/건강', name: '의료/건강', icon: 'HeartPulse', color: 'bg-rose-50 text-rose-800 border-rose-100' },
  { id: '주거/통신', name: '주거/통신', icon: 'Home', color: 'bg-stone-100 text-stone-700 border-stone-200' },
  { id: '금융/보험', name: '금융/보험', icon: 'Landmark', color: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
  { id: '급여', name: '급여', icon: 'Coins', color: 'bg-emerald-50 text-emerald-800 border-emerald-100' },
  { id: '기타', name: '기타', icon: 'MoreHorizontal', color: 'bg-zinc-100 text-zinc-600 border-zinc-200' }
];

export const PAYMENT_METHODS = [
  '신용카드',
  '체크카드',
  '카카오페이',
  '토스페이',
  '네이버페이',
  '계좌이체',
  '현금',
  '기타'
];

// Modern, muted, calm aesthetic palette
export const CATEGORY_COLORS = {
  '식비': '#e2e8f0',
  '카페/간식': '#cbd5e1',
  '마트/생필품': '#94a3b8',
  '교통': '#64748b',
  '쇼핑': '#475569',
  '문화/여가': '#334155',
  '의료/건강': '#f43f5e',
  '주거/통신': '#64748b',
  '금융/보험': '#1e293b',
  '급여': '#10b981',
  '기타': '#94a3b8'
};

export function formatKRW(amount) {
  if (amount === undefined || amount === null) return '0원';
  return Number(amount).toLocaleString('ko-KR') + '원';
}
