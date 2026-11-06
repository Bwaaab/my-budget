import React, { useState } from 'react';
import {
  X,
  Plus,
  Minus,
  Sparkles,
  Trash2,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  SlidersHorizontal,
  CheckCircle2
} from 'lucide-react';
import {
  POINT_PROVIDERS,
  CATEGORIES,
  cleanNumber,
  formatKRW,
  normalizeDateYMD,
  todayYMD,
  nowHM
} from '../constants';

export default function PointWalletModal({
  isOpen,
  onClose,
  points = [],
  pointStats = {},
  selectedProvider = '네이버페이',
  onChangeProvider,
  onSavePoint,
  onDeletePoint,
  onSaveTransaction // For simultaneous general expense recording
}) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState('earn'); // 'earn' | 'use' | 'adjust'
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayYMD());
  const [memo, setMemo] = useState('');

  // General budget sync toggle for "use" tab
  const [includeInExpense, setIncludeInExpense] = useState(true);
  const [expenseCategory, setExpenseCategory] = useState('쇼핑');

  const {
    currentBalance = 0,
    monthlyEarned = 0,
    monthlyUsed = 0
  } = pointStats || {};

  const currentProviderInfo =
    POINT_PROVIDERS.find((p) => p.id === selectedProvider) || POINT_PROVIDERS[0];

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanAmt = cleanNumber(amount);
    if (!cleanAmt || !title.trim()) return;

    const newPointTx = {
      provider: selectedProvider,
      type: activeTab,
      amount: cleanAmt,
      title: title.trim(),
      date: normalizeDateYMD(date) || todayYMD(),
      time: nowHM(),
      memo: memo.trim()
    };

    // If using points and user wants it included in budget expenses
    if (activeTab === 'use' && includeInExpense && onSaveTransaction) {
      onSaveTransaction({
        type: 'expense',
        necessity: 'want',
        amount: cleanAmt,
        merchant: title.trim(),
        date: normalizeDateYMD(date) || todayYMD(),
        time: nowHM(),
        category: expenseCategory,
        payment_method: `${selectedProvider}(포인트)`,
        memo: memo.trim() ? `[포인트사용] ${memo.trim()}` : `[포인트사용]`
      });
    }

    onSavePoint(newPointTx);

    // Reset input form
    setAmount('');
    setTitle('');
    setMemo('');
  };

  // Filter list for current provider
  const filteredPoints = points.filter(
    (p) => !selectedProvider || selectedProvider === 'all' || p.provider === selectedProvider
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-zinc-200/80 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#03c75a] text-white flex items-center justify-center font-black text-sm shadow-xs">
              N
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 leading-tight">
                포인트 지갑 관리
              </h2>
              <p className="text-[11px] text-zinc-500">
                {currentProviderInfo.name} 포인트 적립 · 사용 · 잔액 기록
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-zinc-200/60 text-zinc-400 hover:text-zinc-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Container */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Provider Selector Tabs */}
          <div className="flex bg-zinc-100 p-1 rounded-2xl gap-1">
            {POINT_PROVIDERS.map((prov) => (
              <button
                key={prov.id}
                type="button"
                onClick={() => onChangeProvider(prov.id)}
                className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition ${
                  selectedProvider === prov.id
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                {prov.name}
              </button>
            ))}
          </div>

          {/* Balance Card */}
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 text-white rounded-2xl p-4 sm:p-5 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-medium mb-1">
              <span>보유 포인트 잔액</span>
              <span className="flex items-center gap-1 text-[11px] bg-zinc-700/60 px-2 py-0.5 rounded-lg text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3 h-3" /> 실시간 계산
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-baseline gap-1">
              <span>{formatKRW(currentBalance).replace('원', '')}</span>
              <span className="text-sm font-semibold text-emerald-400">P</span>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-zinc-700/50 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <ArrowDownRight className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-[10px] text-zinc-400">이번 달 적립</div>
                  <div className="font-bold text-emerald-400">+{formatKRW(monthlyEarned).replace('원', '')} P</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-[10px] text-zinc-400">이번 달 사용</div>
                  <div className="font-bold text-rose-300">-{formatKRW(monthlyUsed).replace('원', '')} P</div>
                </div>
              </div>
            </div>
          </div>

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-3.5 sm:p-4 space-y-3">
            {/* Type Toggle */}
            <div className="grid grid-cols-3 gap-1 bg-zinc-200/70 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('earn')}
                className={`py-1.5 rounded-lg transition flex items-center justify-center gap-1 ${
                  activeTab === 'earn'
                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <Plus className="w-3 h-3" />
                <span>적립 (+)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('use')}
                className={`py-1.5 rounded-lg transition flex items-center justify-center gap-1 ${
                  activeTab === 'use'
                    ? 'bg-rose-600 text-white shadow-xs font-bold'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <Minus className="w-3 h-3" />
                <span>사용 (-)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('adjust')}
                className={`py-1.5 rounded-lg transition flex items-center justify-center gap-1 ${
                  activeTab === 'adjust'
                    ? 'bg-zinc-900 text-white shadow-xs font-bold'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
                title="포인트 잔액을 직접 맞출 때 사용"
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>잔액조정</span>
              </button>
            </div>

            {/* Amount & Title */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                  {activeTab === 'adjust' ? '조정할 잔액 (P)' : '포인트 금액 (P)'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full text-base font-extrabold px-3 py-1.5 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">
                    P
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                  {activeTab === 'earn'
                    ? '적립처 / 내용'
                    : activeTab === 'use'
                    ? '사용처 / 구매처'
                    : '조정 사유'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    activeTab === 'earn'
                      ? '예: 네이버쇼핑 리뷰, 구매확정 리워드'
                      : activeTab === 'use'
                      ? '예: 배달의민족 결제 시 사용, 쿠팡'
                      : '예: 현재 앱 잔액과 맞춤'
                  }
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none"
                />
              </div>
            </div>

            {/* Date & Memo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                  일자
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-zinc-200 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                  메모 (선택)
                </label>
                <input
                  type="text"
                  placeholder="간단한 메모"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 bg-white border border-zinc-200 rounded-xl outline-none"
                />
              </div>
            </div>

            {/* General budget sync toggle for "use" */}
            {activeTab === 'use' && (
              <div className="p-2.5 bg-white rounded-xl border border-zinc-200/80 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-zinc-800">
                  <input
                    type="checkbox"
                    checked={includeInExpense}
                    onChange={(e) => setIncludeInExpense(e.target.checked)}
                    className="w-4 h-4 rounded text-zinc-900 accent-zinc-900 cursor-pointer"
                  />
                  <span>가계부 소비 지출에도 함께 기록 (현금처럼 사용)</span>
                </label>

                {includeInExpense && (
                  <div className="pl-6 flex items-center gap-2">
                    <span className="text-[11px] text-zinc-500 whitespace-nowrap">소비 카테고리:</span>
                    <select
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value)}
                      className="text-xs bg-zinc-100 border border-zinc-200 rounded-lg px-2 py-1 outline-none font-medium"
                    >
                      {CATEGORIES.filter((c) => c.name !== '급여' && c.name !== '저축/투자').map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>포인트 내역 등록</span>
            </button>
          </form>

          {/* History List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-zinc-800">
                최근 {currentProviderInfo.name} 포인트 내역 ({filteredPoints.length}건)
              </h3>
            </div>

            {filteredPoints.length === 0 ? (
              <div className="text-center py-8 text-zinc-400 text-xs bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                등록된 포인트 내역이 없습니다.
                <br />
                위 입력창에서 적립(+) 또는 사용(-)을 기록해 보세요.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                {filteredPoints.map((p) => {
                  const isEarn = p.type === 'earn';
                  const isUse = p.type === 'use';
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200/60 transition group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                            isEarn
                              ? 'bg-emerald-100 text-emerald-700'
                              : isUse
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-zinc-200 text-zinc-700'
                          }`}
                        >
                          {isEarn ? '+' : isUse ? '-' : '='}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-zinc-900 truncate">
                            {p.title}
                          </div>
                          <div className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                            <span>{p.date}</span>
                            {p.memo && <span>· {p.memo}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        <span
                          className={`text-xs font-extrabold ${
                            isEarn
                              ? 'text-emerald-600'
                              : isUse
                              ? 'text-zinc-900'
                              : 'text-zinc-500'
                          }`}
                        >
                          {isEarn ? '+' : isUse ? '-' : ''}
                          {formatKRW(p.amount).replace('원', '')} P
                        </span>
                        <button
                          type="button"
                          onClick={() => onDeletePoint(p.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-300 hover:text-rose-500 transition"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
