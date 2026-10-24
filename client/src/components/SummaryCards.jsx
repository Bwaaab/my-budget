import React from 'react';
import { Target } from 'lucide-react';
import { formatKRW } from '../constants';

export default function SummaryCards({ stats, onOpenBudgetEdit }) {
  const {
    totalExpense = 0,
    totalIncome = 0,
    balance = 0,
    monthlyBudget = 1200000,
    remainingBudget = 0,
    budgetPercent = 0
  } = stats || {};

  const isOverBudget = remainingBudget < 0;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total Expense */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-zinc-200/70 shadow-xs min-w-0">
          <div className="text-xs font-medium text-zinc-500 mb-1.5 whitespace-nowrap">이번 달 지출</div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-zinc-900 tracking-tight whitespace-nowrap truncate">
            {formatKRW(totalExpense)}
          </div>
          <div className="mt-2 text-[11px] text-zinc-400 whitespace-nowrap">
            소비 총액
          </div>
        </div>

        {/* Total Income */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-zinc-200/70 shadow-xs min-w-0">
          <div className="text-xs font-medium text-zinc-500 mb-1.5 whitespace-nowrap">이번 달 수입</div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-zinc-900 tracking-tight whitespace-nowrap truncate">
            {formatKRW(totalIncome)}
          </div>
          <div className="mt-2 text-[11px] text-zinc-400 whitespace-nowrap">
            급여 및 부수입
          </div>
        </div>

        {/* Balance / Net Savings */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-zinc-200/70 shadow-xs min-w-0">
          <div className="text-xs font-medium text-zinc-500 mb-1.5 whitespace-nowrap">월 수지 (남은 돈)</div>
          <div className={`text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight whitespace-nowrap truncate ${balance >= 0 ? 'text-zinc-900' : 'text-rose-700'}`}>
            {balance > 0 ? `+${formatKRW(balance)}` : formatKRW(balance)}
          </div>
          <div className="mt-2 text-[11px] text-zinc-400 whitespace-nowrap">
            {balance >= 0 ? '저축 가능한 잉여금' : '수입 초과 지출'}
          </div>
        </div>
      </div>

      {/* Monthly Budget Tracker Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-zinc-200/70 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Target className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
            <span className="text-xs sm:text-sm font-semibold text-zinc-800 whitespace-nowrap">
              지출 목표 예산
            </span>
            <button
              onClick={onOpenBudgetEdit}
              className="text-xs text-zinc-400 hover:text-zinc-700 underline ml-1 whitespace-nowrap flex-shrink-0"
            >
              설정
            </button>
          </div>
          <div className="text-xs sm:text-sm font-bold text-zinc-800 whitespace-nowrap">
            {budgetPercent}% <span className="font-normal text-zinc-400">({formatKRW(totalExpense)} / {formatKRW(monthlyBudget)})</span>
          </div>
        </div>

        {/* Minimal Progress Track */}
        <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              budgetPercent > 90 ? 'bg-rose-600' : 'bg-zinc-800'
            }`}
            style={{ width: `${Math.min(budgetPercent, 100)}%` }}
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
          <span className="whitespace-nowrap">
            {isOverBudget ? (
              <span className="text-rose-600 font-semibold">
                예산 {formatKRW(Math.abs(remainingBudget))} 초과
              </span>
            ) : (
              <span>남은 예산: <strong className="text-zinc-900 font-bold">{formatKRW(remainingBudget)}</strong></span>
            )}
          </span>
          <span className="text-zinc-400 whitespace-nowrap">목표: {formatKRW(monthlyBudget)}</span>
        </div>
      </div>
    </div>
  );
}
