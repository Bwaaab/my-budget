import React, { useState, useEffect } from 'react';
import { X, Target, Plus, RotateCcw, Check, Sparkles } from 'lucide-react';
import { EXPENSE_BUDGET_CATEGORIES, formatKRW } from '../constants';
import CategoryIcon from './CategoryIcon';

export default function CategoryBudgetModal({
  isOpen,
  onClose,
  categoryBudgets = {},
  monthlyBudget = 1200000,
  onSaveCategoryBudgets
}) {
  const [localBudgets, setLocalBudgets] = useState({});

  useEffect(() => {
    if (isOpen) {
      setLocalBudgets(categoryBudgets ? { ...categoryBudgets } : {});
    }
  }, [isOpen, categoryBudgets]);

  if (!isOpen) return null;

  const handleAmountChange = (category, valueStr) => {
    const cleanNum = parseInt(valueStr.replace(/[^0-9]/g, ''), 10) || 0;
    setLocalBudgets(prev => {
      const next = { ...prev };
      if (cleanNum > 0) {
        next[category] = cleanNum;
      } else {
        delete next[category];
      }
      return next;
    });
  };

  const handleAddAmount = (category, increment) => {
    setLocalBudgets(prev => {
      const current = prev[category] || 0;
      const nextVal = Math.max(0, current + increment);
      const next = { ...prev };
      if (nextVal > 0) {
        next[category] = nextVal;
      } else {
        delete next[category];
      }
      return next;
    });
  };

  const handleResetAll = () => {
    if (window.confirm('모든 카테고리별 예산을 초기화하시겠습니까?')) {
      setLocalBudgets({});
    }
  };

  const handleSave = () => {
    onSaveCategoryBudgets(localBudgets);
    onClose();
  };

  // Compute Total Category Budgets
  const totalAssigned = Object.values(localBudgets).reduce((sum, val) => sum + (Number(val) || 0), 0);
  const diff = monthlyBudget - totalAssigned;
  const percentOfTotal = monthlyBudget > 0 ? Math.round((totalAssigned / monthlyBudget) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col border border-zinc-200/80 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between flex-shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900">카테고리별 지출 목표 예산</h2>
              <p className="text-xs text-zinc-400">자주 쓰는 카테고리별로 예산을 나누어 계획해보세요</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/80 flex items-center justify-center transition active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Budget Allocation Summary Bar */}
        <div className="p-3.5 sm:p-4 bg-zinc-50/80 border-b border-zinc-100 flex-shrink-0">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-zinc-700">카테고리 예산 배분 현황</span>
            <span className="font-bold text-zinc-900">
              {formatKRW(totalAssigned)} <span className="text-zinc-400 font-normal">/ {formatKRW(monthlyBudget)}</span>
            </span>
          </div>

          <div className="w-full h-2 bg-zinc-200/80 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                percentOfTotal > 100 ? 'bg-rose-600' : 'bg-zinc-900'
              }`}
              style={{ width: `${Math.min(percentOfTotal, 100)}%` }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-zinc-400">
              배분율 {percentOfTotal}%
            </span>
            <span>
              {diff > 0 ? (
                <span className="text-zinc-600 font-medium">미배정 잔여: +{formatKRW(diff)}</span>
              ) : diff < 0 ? (
                <span className="text-rose-600 font-bold">목표 예산 {formatKRW(Math.abs(diff))} 초과 배정</span>
              ) : (
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" /> 전체 예산과 딱 맞음
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Category List (Scrollable) */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-2.5 flex-1 divide-y divide-zinc-100">
          {EXPENSE_BUDGET_CATEGORIES.map(category => {
            const currentAmount = localBudgets[category] || 0;
            return (
              <div key={category} className="pt-2.5 first:pt-0">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <CategoryIcon category={category} size={15} className="p-1.5 rounded-lg" />
                    <span className="text-xs sm:text-sm font-semibold text-zinc-800">{category}</span>
                  </div>
                  {currentAmount > 0 && (
                    <span className="text-xs font-bold text-zinc-900">
                      {formatKRW(currentAmount)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="예산 미설정"
                      value={currentAmount > 0 ? currentAmount.toLocaleString() : ''}
                      onChange={(e) => handleAmountChange(category, e.target.value)}
                      className="w-full bg-zinc-50 hover:bg-zinc-100/60 focus:bg-white text-xs sm:text-sm font-semibold text-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-200/80 focus:border-zinc-900 focus:outline-none transition"
                    />
                    {currentAmount > 0 && (
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 pointer-events-none">
                        원
                      </span>
                    )}
                  </div>

                  {/* Quick Increment Buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleAddAmount(category, 50000)}
                      className="px-2 py-1.5 bg-zinc-100 hover:bg-zinc-200/80 active:bg-zinc-200 text-zinc-700 text-[11px] font-semibold rounded-lg border border-zinc-200/60 transition active:scale-95"
                    >
                      +5만
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddAmount(category, 100000)}
                      className="px-2 py-1.5 bg-zinc-100 hover:bg-zinc-200/80 active:bg-zinc-200 text-zinc-700 text-[11px] font-semibold rounded-lg border border-zinc-200/60 transition active:scale-95"
                    >
                      +10만
                    </button>
                    {currentAmount > 0 && (
                      <button
                        type="button"
                        onClick={() => handleAmountChange(category, '0')}
                        className="px-1.5 py-1.5 bg-zinc-100 hover:bg-rose-50 hover:text-rose-600 active:bg-rose-100 text-zinc-400 text-[11px] font-semibold rounded-lg border border-zinc-200/60 transition"
                        title="초기화"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-zinc-100 flex items-center justify-between gap-3 bg-white flex-shrink-0">
          <button
            type="button"
            onClick={handleResetAll}
            className="px-3 py-2 text-xs font-semibold text-zinc-500 hover:text-rose-600 transition"
          >
            전체 비우기
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold rounded-xl transition"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>예산 저장</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
