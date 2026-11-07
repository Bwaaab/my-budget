import React from 'react';
import { Target, PiggyBank, Coins, Plus } from 'lucide-react';
import { formatKRW } from '../constants';

export default function SummaryCards({ stats, onOpenPointAdd, onOpenBudgetEdit }) {
  const {
    totalExpense = 0,
    totalNeedExpense = 0,
    totalWantExpense = 0,
    needPercent = 0,
    wantPercent = 0,
    totalIncome = 0,
    totalSaving = 0,
    allTimeSaving = 0,
    balance = 0,
    cashBalance,
    totalPointBalance = 0,
    monthlyPointEarned = 0,
    monthlyPointUsed = 0,
    monthlyBalance = 0,
    monthlyBudget = 1200000,
    remainingBudget = 0,
    budgetPercent = 0
  } = stats || {};

  const pointBalance = totalPointBalance || 0;
  const actualCashBalance = cashBalance !== undefined ? cashBalance : (balance - pointBalance);
  const isOverBudget = remainingBudget < 0;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* 4 Metric Cards (2x2 on Mobile, 4 columns on Desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* 1. Total Expense */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-zinc-200/70 shadow-xs min-w-0">
          <div className="text-xs font-medium text-zinc-500 mb-1 sm:mb-1.5 whitespace-nowrap">이번 달 지출</div>
          <div className="text-lg sm:text-2xl font-extrabold text-zinc-900 tracking-tight whitespace-nowrap truncate">
            {formatKRW(totalExpense)}
          </div>
          <div className="mt-1.5 sm:mt-2 text-[11px] text-zinc-400 whitespace-nowrap truncate">
            {totalExpense > 0 ? (
              <span>
                필수 {formatKRW(totalNeedExpense)} · <span className="text-zinc-600 font-medium">선택 {formatKRW(totalWantExpense)}</span>
              </span>
            ) : (
              '순수 소비 지출액'
            )}
          </div>
        </div>

        {/* 2. Total Saving / Investment */}
        <div className="bg-zinc-900 text-white rounded-2xl p-3.5 sm:p-5 border border-zinc-800 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-1 mb-1 sm:mb-1.5">
            <span className="text-xs font-medium text-zinc-300 whitespace-nowrap">저축 · 투자</span>
            <PiggyBank className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
          </div>
          <div className="text-lg sm:text-2xl font-extrabold text-white tracking-tight whitespace-nowrap truncate">
            {formatKRW(totalSaving)}
          </div>
          <div className="mt-1.5 sm:mt-2 text-[11px] text-zinc-400 whitespace-nowrap truncate">
            {allTimeSaving > totalSaving
              ? `누적 총 ${formatKRW(allTimeSaving)}`
              : '모아둔 미래 자산'}
          </div>
        </div>

        {/* 3. Total Income */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-zinc-200/70 shadow-xs min-w-0">
          <div className="text-xs font-medium text-zinc-500 mb-1 sm:mb-1.5 whitespace-nowrap">이번 달 수입</div>
          <div className="text-lg sm:text-2xl font-extrabold text-zinc-900 tracking-tight whitespace-nowrap truncate">
            {formatKRW(totalIncome)}
          </div>
          <div className="mt-1.5 sm:mt-2 text-[11px] text-zinc-400 whitespace-nowrap truncate">
            급여 및 부수입
          </div>
        </div>

        {/* 4. Available Balance (Cumulative Cash + Points) */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-zinc-200/70 shadow-xs min-w-0">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-500 mb-1 sm:mb-1.5 whitespace-nowrap">
            <span>가용 잔액 (쓸 수 있는 돈)</span>
            {pointBalance > 0 && (
              <span className="text-[10px] text-zinc-700 bg-zinc-100 border border-zinc-200 px-1.5 py-0.2 rounded-md font-semibold">
                포인트 포함
              </span>
            )}
          </div>
          <div className={`text-lg sm:text-2xl font-extrabold tracking-tight whitespace-nowrap truncate ${balance >= 0 ? 'text-zinc-900' : 'text-rose-700'}`}>
            {balance > 0 ? `+${formatKRW(balance)}` : formatKRW(balance)}
          </div>
          <div className="mt-1.5 sm:mt-2 text-[11px] text-zinc-400 whitespace-nowrap truncate">
            {pointBalance > 0 ? (
              <span>
                현금 {formatKRW(actualCashBalance)} + <span className="text-zinc-700 font-semibold">{formatKRW(pointBalance).replace('원', '')}P</span>
              </span>
            ) : monthlyBalance !== 0 ? (
              `이달 증감 ${monthlyBalance > 0 ? `+${formatKRW(monthlyBalance)}` : formatKRW(monthlyBalance)}`
            ) : (
              '전체 누적 실가용 현금'
            )}
          </div>
        </div>
      </div>

      {/* Minimal Monochrome Point Summary Bar */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-zinc-200/70 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-zinc-100 text-zinc-800 border border-zinc-200/60 flex items-center justify-center flex-shrink-0">
            <Coins className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-zinc-900">보유 포인트</span>
              <span className="text-xs font-extrabold text-zinc-900">
                {formatKRW(pointBalance).replace('원', '')}P
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 truncate mt-0.5">
              이번 달 적립 <span className="text-zinc-700 font-semibold">+{formatKRW(monthlyPointEarned).replace('원', '')}P</span> · 사용 <span className="text-zinc-600 font-semibold">-{formatKRW(monthlyPointUsed).replace('원', '')}P</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenPointAdd}
          className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200/80 text-zinc-800 text-xs font-semibold rounded-xl border border-zinc-200/60 transition active:scale-95 flex items-center gap-1 whitespace-nowrap flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>포인트 기록</span>
        </button>
      </div>

      {/* Monthly Budget Tracker Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-zinc-200/70 shadow-xs space-y-3.5">
        {/* Budget Progress */}
        <div>
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

        {/* Necessity Ratio Bar (필수 vs 아낄 수 있었던 돈) */}
        {totalExpense > 0 && (
          <div className="pt-3 border-t border-zinc-100">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-zinc-800 whitespace-nowrap">지출 성격 분석</span>
                <span className="text-[10px] text-zinc-400 whitespace-nowrap">(필수 vs 아낄 수 있었던 돈)</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold flex-shrink-0">
                <span className="inline-flex items-center gap-1.5 text-zinc-800 whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-zinc-900 flex-shrink-0" />
                  필수 {formatKRW(totalNeedExpense)} <span className="text-zinc-400 font-normal">({needPercent}%)</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-zinc-600 whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-zinc-400 flex-shrink-0" />
                  선택 {formatKRW(totalWantExpense)} <span className="text-zinc-400 font-normal">({wantPercent}%)</span>
                </span>
              </div>
            </div>

            <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-zinc-900 transition-all duration-500"
                style={{ width: `${needPercent}%` }}
                title={`필수: ${formatKRW(totalNeedExpense)} (${needPercent}%)`}
              />
              <div
                className="h-full bg-zinc-400 transition-all duration-500"
                style={{ width: `${wantPercent}%` }}
                title={`선택(아낄 수 있었던 돈): ${formatKRW(totalWantExpense)} (${wantPercent}%)`}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
