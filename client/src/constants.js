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
  { id: '저축/투자', name: '저축/투자', icon: 'PiggyBank', color: 'bg-indigo-50 text-indigo-800 border-indigo-100' },
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
  '저축/투자': '#4f46e5',
  '급여': '#10b981',
  '기타': '#94a3b8'
};

export function isSavingTx(t) {
  if (!t) return false;
  return t.type === 'saving' || t.category === '저축/투자' || t.category === '저축' || t.category === '투자';
}

export const NECESSITY_OPTIONS = [
  { id: 'need', label: '필수', fullLabel: '필수 (꼭 필요한 돈)' },
  { id: 'want', label: '선택', fullLabel: '선택 (아낄 수 있었던 돈)' }
];

export function getNecessity(t) {
  if (!t) return 'need';
  if (t.necessity === 'want' || t.necessity === '선택') return 'want';
  if (t.necessity === 'need' || t.necessity === '필수') return 'need';
  if (t.memo && (t.memo.includes('[선택]') || t.memo.includes('(선택)'))) return 'want';
  // Default discretionary categories when unspecified
  if (['카페/간식', '쇼핑', '문화/여가'].includes(t.category)) return 'want';
  return 'need';
}

export function cleanNumber(val) {
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : Math.abs(Math.round(val));
  }
  if (!val) return 0;
  const digits = String(val).replace(/[^0-9]/g, '');
  const num = parseInt(digits, 10);
  return isNaN(num) ? 0 : Math.abs(num);
}

export function formatKRW(amount) {
  const num = cleanNumber(amount);
  return num.toLocaleString('ko-KR') + '원';
}

const pad2 = (n) => String(n).padStart(2, '0');

// 기기 로컬 시간 기준 YYYY-MM-DD 반환 (toISOString()은 UTC 기준이라 KST 오전 0~9시에 어제로 잡히는 문제 해결)
export function todayYMD(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// 기기 로컬 시간 기준 HH:mm 반환
export function nowHM(d = new Date()) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// Normalize any date string (including Google Sheets, "26.10.25", "10/25", "10월 25일") to "YYYY-MM-DD"
export function normalizeDateYMD(raw, fallbackYear = new Date().getFullYear()) {
  if (!raw) return todayYMD();
  const str = String(raw).trim();

  // 1. "YYYY-MM-DD" or "YYYY.MM.DD" or "YYYY/MM/DD"
  const ymdMatch = str.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
  }

  // 2. 2-digit year: "YY.MM.DD" (e.g. 26.10.25 or 24.10.25)
  const yyMatch = str.match(/^(\d{2})[-./](\d{1,2})[-./](\d{1,2})/);
  if (yyMatch) {
    const fullYear = 2000 + Number(yyMatch[1]);
    return `${fullYear}-${yyMatch[2].padStart(2, '0')}-${yyMatch[3].padStart(2, '0')}`;
  }

  // 3. Korean format: "YYYY년 M월 D일"
  const korFullMatch = str.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (korFullMatch) {
    return `${korFullMatch[1]}-${korFullMatch[2].padStart(2, '0')}-${korFullMatch[3].padStart(2, '0')}`;
  }

  // 4. Month-Day without year: "MM-DD", "MM.DD", "MM/DD" or "M월 D일"
  const mdMatch = str.match(/^(\d{1,2})[-./](\d{1,2})/) || str.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (mdMatch) {
    return `${fallbackYear}-${mdMatch[1].padStart(2, '0')}-${mdMatch[2].padStart(2, '0')}`;
  }

  // 5. JavaScript Date parse fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return todayYMD();
}

// Compact date display for cards & badges: "26.10.24"
export function formatShortDate(raw) {
  if (!raw) return '';
  const ymd = normalizeDateYMD(raw);
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[1].slice(2)}.${match[2]}.${match[3]}`;
  }
  return ymd;
}

// Normalize time string (including Google Sheets "Sat Dec 30 1899 14:30:00...") to "HH:mm"
export function normalizeTimeHM(raw) {
  if (!raw) return '';
  const str = String(raw).trim();
  const hmMatch = str.match(/^(\d{1,2}):(\d{2})/);
  if (hmMatch) {
    return `${hmMatch[1].padStart(2, '0')}:${hmMatch[2]}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const h = String(parsed.getHours()).padStart(2, '0');
    const m = String(parsed.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
  return '';
}
