import React from 'react';
import { TrendingDown, TrendingUp, PiggyBank, Target, ArrowUpRight } from 'lucide-react';
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

  // Determine budget bar color
  let progressColor = 'bg-indigo-600';
  if (budgetPercent > 90) progressColor = 'bg-rose-500';
  else if (budgetPercent > 75) progressColor = 'bg-amber-500';

  return (
    <div className="space-y-4">
      {/* 3 Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Total Expense */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs sm:text-sm font-medium">이번 달 지출</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {formatKRW(totalExpense)}
          </div>
          <div className="mt-2 text-xs text-rose-500 font-medium flex items-center gap-1">
            <span>이번 달 총 소비액</span>
          </div>
        </div>

        {/* Total Income */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs sm:text-sm font-medium">이번 달 수입</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {formatKRW(totalIncome)}
          </div>
          <div className="mt-2 text-xs text-emerald-600 font-medium flex items-center gap-1">
            <span>급여 및 부수입</span>
          </div>
        </div>

        {/* Balance / Net Savings */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs sm:text-sm font-medium">월 수지 (남은 돈)</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${balance >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
            {balance > 0 ? `+${formatKRW(balance)}` : formatKRW(balance)}
          </div>
          <div className="mt-2 text-xs text-slate-500 font-medium">
            {balance >= 0 ? '저축 가능한 잉여금' : '수입 초과 지출'}
          </div>
        </div>
      </div>

      {/* Monthly Budget Tracker Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-600" />
            <span className="text-xs sm:text-sm font-semibold text-slate-800">
              월간 지출 목표 예산
            </span>
            <button
              onClick={onOpenBudgetEdit}
              className="text-xs text-indigo-600 hover:underline flex items-center gap-0.5 ml-1"
            >
              예산 변경 <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="text-xs sm:text-sm font-bold text-slate-700">
            {budgetPercent}% <span className="font-normal text-slate-400">({formatKRW(totalExpense)} / {formatKRW(monthlyBudget)})</span>
          </div>
        </div>

        {/* Progress Track */}
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/50">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
            style={{ width: `${Math.min(budgetPercent, 100)}%` }}
          />
        </div>

        <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500">
          <span>
            {isOverBudget ? (
              <span className="text-rose-600 font-semibold">
                ⚠️ 예산을 {formatKRW(Math.abs(remainingBudget))} 초과했습니다!
              </span>
            ) : (
              <span>남은 예산: <strong className="text-slate-800 font-bold">{formatKRW(remainingBudget)}</strong></span>
            )}
          </span>
          <span>목표: {formatKRW(monthlyBudget)}</span>
        </div>
      </div>
    </div>
  );
}
