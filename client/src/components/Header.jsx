import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  QrCode,
  Settings,
  Sparkles,
  Plus,
  Loader2
} from 'lucide-react';
import Logo from './Logo';

export default function Header({
  currentDate,
  periodMode = 'month',
  onChangePeriodMode,
  weekTitle = '',
  monthStartDay = 1,
  rangeLabel = '',
  onPrevMonth,
  onNextMonth,
  onGoToday,
  onOpenScanner,
  onOpenAddModal,
  onOpenQrModal,
  onOpenSettingsModal,
  onSyncGoogleSheets,
  isSyncing,
  hasApiKey,
  hasGoogleSheets
}) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const isWeek = periodMode === 'week';

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200/70 px-3 py-2.5 sm:px-6 w-full max-w-full overflow-hidden">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-1.5 sm:gap-2 w-full">
        {/* Brand & Period Navigator */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <Logo size={30} />
          <h1 className="text-sm sm:text-base font-bold text-zinc-900 tracking-tight leading-tight hidden md:block">
            가계부
          </h1>

          {/* Period Mode Toggle (월간 / 주간) */}
          {onChangePeriodMode && (
            <div className="flex items-center bg-zinc-100 rounded-xl p-0.5 border border-zinc-200/50 flex-shrink-0">
              <button
                type="button"
                onClick={() => onChangePeriodMode('month')}
                className={`px-1.5 sm:px-2 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer whitespace-nowrap ${
                  !isWeek
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                월간
              </button>
              <button
                type="button"
                onClick={() => onChangePeriodMode('week')}
                className={`px-1.5 sm:px-2 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer whitespace-nowrap ${
                  isWeek
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                주간
              </button>
            </div>
          )}

          {/* Month / Week Selector */}
          <div className="flex items-center bg-zinc-100 rounded-xl p-0.5 border border-zinc-200/50 flex-shrink-0">
            <button
              type="button"
              onClick={onPrevMonth}
              className="p-1 sm:p-1.5 rounded-lg hover:bg-white text-zinc-600 hover:text-zinc-900 transition-colors flex-shrink-0 cursor-pointer"
              title={isWeek ? '이전 주' : '이전 달'}
            >
              <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              onClick={onGoToday}
              className="flex flex-col sm:flex-row items-center justify-center sm:gap-1.5 px-1 sm:px-2.5 py-0.5 leading-none cursor-pointer hover:opacity-80 transition"
              title={isWeek ? '클릭하면 이번 주로 이동' : '클릭하면 이번 달로 이동'}
            >
              <span className="text-[11px] sm:text-sm font-bold text-zinc-800 tracking-tight text-center whitespace-nowrap">
                {isWeek ? (weekTitle || `${month}월`) : `${year}년 ${month}월`}
              </span>
              {(isWeek || (monthStartDay && monthStartDay !== 1)) && rangeLabel && (
                <span
                  className="text-[9px] sm:text-[11px] font-semibold sm:font-medium sm:px-1.5 sm:py-0.5 rounded-md sm:bg-zinc-200 text-zinc-500 sm:text-zinc-700 whitespace-nowrap mt-0.5 sm:mt-0"
                  title={`집계 기간: ${rangeLabel}`}
                >
                  {rangeLabel}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onNextMonth}
              className="p-1 sm:p-1.5 rounded-lg hover:bg-white text-zinc-600 hover:text-zinc-900 transition-colors flex-shrink-0 cursor-pointer"
              title={isWeek ? '다음 주' : '다음 달'}
            >
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Compact Google Sheets Sync Status Indicator */}
          <button
            type="button"
            onClick={hasGoogleSheets ? onSyncGoogleSheets : onOpenSettingsModal}
            disabled={isSyncing}
            className={`w-8 h-8 flex items-center justify-center rounded-xl border transition active:scale-95 flex-shrink-0 cursor-pointer ${
              hasGoogleSheets
                ? 'border-zinc-200 bg-white hover:bg-zinc-50'
                : 'border-amber-200 bg-amber-50/70 hover:bg-amber-100/70'
            }`}
            title={
              isSyncing
                ? 'DB 동기화 중...'
                : hasGoogleSheets
                ? 'DB 연동 완료 — 클릭하여 최신 내역 동기화'
                : 'DB 미연동 — 클릭하여 연동 설정'
            }
            aria-label={isSyncing ? 'DB 동기화 중' : hasGoogleSheets ? 'DB 연동 완료' : 'DB 미연동'}
          >
            {isSyncing ? (
              <Loader2 className="w-3.5 h-3.5 text-emerald-500 animate-spin" />
            ) : !hasGoogleSheets ? (
              <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
            ) : (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.55)]" />
            )}
          </button>

          {/* QR Code Phone Sync button (Desktop & Tablet only) */}
          <button
            onClick={onOpenQrModal}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white hover:bg-zinc-50 rounded-xl transition border border-zinc-200 whitespace-nowrap flex-shrink-0"
            title="스마트폰 연결"
          >
            <QrCode className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
            <span className="hidden lg:inline text-xs whitespace-nowrap">폰 연결</span>
          </button>

          {/* Settings button */}
          <button
            onClick={onOpenSettingsModal}
            className="p-2 rounded-xl text-zinc-600 bg-white hover:bg-zinc-50 transition border border-zinc-200 relative flex-shrink-0"
            title="설정"
          >
            <Settings className="w-3.5 h-3.5" />
            {(!hasApiKey || !hasGoogleSheets) && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-zinc-900"></span>
            )}
          </button>

          {/* AI Scan Action (Desktop only - Mobile has prominent center floating button) */}
          <button
            onClick={onOpenScanner}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl shadow-xs transition active:scale-95 whitespace-nowrap flex-shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-zinc-300 flex-shrink-0" />
            <span className="whitespace-nowrap">AI 인식</span>
          </button>

          {/* Direct Add Button (Desktop only) */}
          <button
            onClick={onOpenAddModal}
            className="hidden md:flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200/70 rounded-xl border border-zinc-200/60 transition active:scale-95 whitespace-nowrap flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="whitespace-nowrap">직접 입력</span>
          </button>
        </div>
      </div>
    </header>
  );
}
