import React, { useState } from 'react';
import {
  Search,
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
    <div className="bg-white rounded-2xl border border-zinc-200/70 shadow-xs p-4 sm:p-5">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-zinc-900">상세 내역</h3>
          <p className="text-[11px] text-zinc-400">총 {filtered.length}건</p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Type Toggle */}
          <div className="flex bg-zinc-100 rounded-xl p-0.5 text-xs font-semibold">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg transition ${
                filterType === 'all' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setFilterType('expense')}
              className={`px-2.5 py-1 rounded-lg transition ${
                filterType === 'expense' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              지출
            </button>
            <button
              onClick={() => setFilterType('income')}
              className={`px-2.5 py-1 rounded-lg transition ${
                filterType === 'income' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              수입
            </button>
          </div>

          {/* Category Dropdown */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-xs bg-zinc-100 text-zinc-700 rounded-xl px-2.5 py-1 border-none outline-none"
          >
            <option value="all">전체 카테고리</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Search Box */}
          <div className="relative flex-1 sm:w-40">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1 bg-zinc-100 rounded-xl focus:bg-white focus:ring-1 focus:ring-zinc-400 outline-none transition"
            />
          </div>
        </div>
      </div>

      {/* Transactions List */}
      {dates.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-500 flex items-center justify-center mb-2">
            <Sparkles className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-zinc-700">해당 조건의 내역이 없습니다</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={onOpenScanner}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl shadow-xs transition"
            >
              AI 캡처 인식
            </button>
            <button
              onClick={onOpenAddModal}
              className="px-3 py-1.5 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition"
            >
              직접 입력
            </button>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {dates.map((dateStr) => {
            const group = groupedByDate[dateStr];
            return (
              <div key={dateStr} className="py-2.5 first:pt-1">
                {/* Date Group Header */}
                <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 mb-1 px-1">
                  <span>{formatDayHeader(dateStr)}</span>
                  <div className="flex gap-2">
                    {group.dayExpense > 0 && (
                      <span className="text-zinc-600">지출 -{formatKRW(group.dayExpense)}</span>
                    )}
                    {group.dayIncome > 0 && (
                      <span className="text-zinc-800 font-bold">수입 +{formatKRW(group.dayIncome)}</span>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-1">
                  {group.items.map((t) => (
                    <div
                      key={t.id}
                      className="group flex items-center justify-between p-2 rounded-xl hover:bg-zinc-50 transition"
                    >
                      {/* Left: Icon & Info */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CategoryIcon category={t.category} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs sm:text-sm font-semibold text-zinc-900 truncate">
                              {t.merchant}
                            </span>
                            {t.payment_method && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-500">
                                {t.payment_method}
                              </span>
                            )}
                            {t.image_path && (
                              <button
                                onClick={() => onViewReceipt(t.image_path)}
                                className="text-[10px] flex items-center gap-0.5 text-zinc-600 hover:text-zinc-900 bg-zinc-100 px-1.5 py-0.2 rounded"
                              >
                                <ImageIcon className="w-3 h-3" />
                                <span>사진</span>
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5 truncate">
                            <span>{t.time || ''}</span>
                            <span>•</span>
                            <span>{t.category}</span>
                            {t.memo && (
                              <>
                                <span>•</span>
                                <span className="truncate text-zinc-400">{t.memo}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Amount & Actions */}
                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        <div className="text-right">
                          <span
                            className={`text-xs sm:text-sm font-bold tracking-tight ${
                              t.type === 'expense' ? 'text-zinc-900' : 'text-emerald-700'
                            }`}
                          >
                            {t.type === 'expense' ? `-${formatKRW(t.amount)}` : `+${formatKRW(t.amount)}`}
                          </span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-0.5 opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => onEdit(t)}
                            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition"
                            title="수정"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => onDelete(t.id)}
                            className="p-1 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="삭제"
                          >
                            <Trash2 className="w-3 h-3" />
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
