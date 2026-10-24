import React, { useState } from 'react';
import {
  Search,
  Filter,
  Trash2,
  Edit2,
  Image as ImageIcon,
  Sparkles,
  Plus
} from 'lucide-react';
import { CATEGORIES, formatKRW } from '../constants';
import CategoryIcon from './CategoryIcon';

export default function TransactionList({
  transactions = [],
  onEdit,
  onDelete,
  onViewReceipt,
  onOpenScanner,
  onOpenAddModal
}) {
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filtering
  const filtered = transactions.filter((t) => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterCategory !== 'all' && t.category !== filterCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchMerchant = (t.merchant || '').toLowerCase().includes(q);
      const matchMemo = (t.memo || '').toLowerCase().includes(q);
      const matchMethod = (t.payment_method || '').toLowerCase().includes(q);
      if (!matchMerchant && !matchMemo && !matchMethod) return false;
    }
    return true;
  });

  // Group by Date
  const groupedByDate = filtered.reduce((acc, t) => {
    const date = t.date;
    if (!acc[date]) {
      acc[date] = {
        date,
        items: [],
        dayExpense: 0,
        dayIncome: 0
      };
    }
    acc[date].items.push(t);
    if (t.type === 'expense') acc[date].dayExpense += t.amount;
    else if (t.type === 'income') acc[date].dayIncome += t.amount;
    return acc;
  }, {});

  const dates = Object.keys(groupedByDate).sort((a, b) => (a < b ? 1 : -1));

  const formatDayHeader = (dateStr) => {
    const d = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = days[d.getDay()];
    const [_, m, day] = dateStr.split('-');
    return `${Number(m)}월 ${Number(day)}일 (${dayName})`;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900">상세 내역</h3>
          <p className="text-xs text-slate-500">총 {filtered.length}건의 거래</p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Type Toggle */}
          <div className="flex bg-slate-100 rounded-xl p-0.5 text-xs font-semibold">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterType === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setFilterType('expense')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterType === 'expense' ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              지출
            </button>
            <button
              onClick={() => setFilterType('income')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterType === 'income' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              수입
            </button>
          </div>

          {/* Category Dropdown */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-xs bg-slate-100 text-slate-700 rounded-xl px-2.5 py-1.5 border-none focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="all">전체 카테고리</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Search Box */}
          <div className="relative flex-1 sm:w-44">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="상호·메모 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
            />
          </div>
        </div>
      </div>

      {/* Transactions List */}
      {dates.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-3">
            <Sparkles className="w-7 h-7" />
          </div>
          <p className="text-sm font-semibold text-slate-700">해당 조건의 내역이 없습니다</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            영수증이나 카드 알림 캡처본을 붙여넣으면 AI가 자동으로 가계부에 등록해줍니다!
          </p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={onOpenScanner}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition"
            >
              ✨ AI 캡처 인식하기
            </button>
            <button
              onClick={onOpenAddModal}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            >
              직접 입력
            </button>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {dates.map((dateStr) => {
            const group = groupedByDate[dateStr];
            return (
              <div key={dateStr} className="py-3 first:pt-2">
                {/* Date Group Header */}
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2 px-1">
                  <span>{formatDayHeader(dateStr)}</span>
                  <div className="flex gap-2">
                    {group.dayExpense > 0 && (
                      <span className="text-rose-500">지출 -{formatKRW(group.dayExpense)}</span>
                    )}
                    {group.dayIncome > 0 && (
                      <span className="text-emerald-600">수입 +{formatKRW(group.dayIncome)}</span>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-1.5">
                  {group.items.map((t) => (
                    <div
                      key={t.id}
                      className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-100"
                    >
                      {/* Left: Icon & Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <CategoryIcon category={t.category} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 truncate">
                              {t.merchant}
                            </span>
                            {t.payment_method && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                                {t.payment_method}
                              </span>
                            )}
                            {t.image_path && (
                              <button
                                onClick={() => onViewReceipt(t.image_path)}
                                className="text-[10px] flex items-center gap-0.5 text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-1.5 py-0.5 rounded-md transition"
                                title="원본 영수증/캡처 사진 보기"
                              >
                                <ImageIcon className="w-3 h-3" />
                                <span>사진</span>
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 truncate">
                            <span>{t.time || ''}</span>
                            <span>•</span>
                            <span className="text-slate-600 font-medium">{t.category}</span>
                            {t.memo && (
                              <>
                                <span>•</span>
                                <span className="truncate text-slate-400">{t.memo}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Amount & Actions */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <span
                            className={`text-sm sm:text-base font-extrabold tracking-tight ${
                              t.type === 'expense' ? 'text-rose-600' : 'text-emerald-600'
                            }`}
                          >
                            {t.type === 'expense' ? `-${formatKRW(t.amount)}` : `+${formatKRW(t.amount)}`}
                          </span>
                        </div>

                        {/* Action buttons (always visible or on hover) */}
                        <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => onEdit(t)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                            title="수정"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDelete(t.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
