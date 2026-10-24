export const CATEGORIES = [
  { id: '식비', name: '식비', icon: 'Utensils', color: 'bg-orange-100 text-orange-600 border-orange-200' },
  { id: '카페/간식', name: '카페/간식', icon: 'Coffee', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { id: '마트/생필품', name: '마트/생필품', icon: 'ShoppingCart', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: '교통', name: '교통', icon: 'Car', color: 'bg-blue-100 text-blue-600 border-blue-200' },
  { id: '쇼핑', name: '쇼핑', icon: 'ShoppingBag', color: 'bg-pink-100 text-pink-600 border-pink-200' },
  { id: '문화/여가', name: '문화/여가', icon: 'Film', color: 'bg-purple-100 text-purple-600 border-purple-200' },
  { id: '의료/건강', name: '의료/건강', icon: 'HeartPulse', color: 'bg-rose-100 text-rose-600 border-rose-200' },
  { id: '주거/통신', name: '주거/통신', icon: 'Home', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { id: '금융/보험', name: '금융/보험', icon: 'Landmark', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { id: '급여', name: '급여', icon: 'Coins', color: 'bg-green-100 text-green-700 border-green-200' },
  { id: '기타', name: '기타', icon: 'MoreHorizontal', color: 'bg-slate-100 text-slate-600 border-slate-200' }
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

export const CATEGORY_COLORS = {
  '식비': '#f97316',
  '카페/간식': '#d97706',
  '마트/생필품': '#10b981',
  '교통': '#3b82f6',
  '쇼핑': '#ec4899',
  '문화/여가': '#8b5cf6',
  '의료/건강': '#f43f5e',
  '주거/통신': '#06b6d4',
  '금융/보험': '#6366f1',
  '급여': '#22c55e',
  '기타': '#64748b'
};

export function formatKRW(amount) {
  if (amount === undefined || amount === null) return '0원';
  return Number(amount).toLocaleString('ko-KR') + '원';
}
