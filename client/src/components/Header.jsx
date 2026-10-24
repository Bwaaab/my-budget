import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  QrCode,
  Settings,
  Sparkles,
  Plus,
  RefreshCw
} from 'lucide-react';
import Logo from './Logo';

export default function Header({
  currentDate,
  onPrevMonth,
  onNextMonth,
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

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200/70 px-3 py-2.5 sm:px-6 w-full max-w-full overflow-hidden">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-2 w-full">
        {/* Brand & Month Navigator */}
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          <Logo size={30} />
          <h1 className="text-sm sm:text-base font-bold text-zinc-900 tracking-tight leading-tight hidden xs:block">
            가계부
          </h1>

          {/* Month Selector */}
          <div className="flex items-center bg-zinc-100 rounded-xl p-0.5 border border-zinc-200/50">
            <button
              onClick={onPrevMonth}
              className="p-1 sm:p-1.5 rounded-lg hover:bg-white text-zinc-500 hover:text-zinc-900 transition-colors"
              title="이전 달"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 sm:px-3 text-xs sm:text-sm font-bold text-zinc-800 tracking-tight text-center whitespace-nowrap">
              {year}년 {month}월
            </span>
            <button
              onClick={onNextMonth}
              className="p-1 sm:p-1.5 rounded-lg hover:bg-white text-zinc-500 hover:text-zinc-900 transition-colors"
              title="다음 달"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Google Sheets Sync Button */}
          <button
            onClick={hasGoogleSheets ? onSyncGoogleSheets : onOpenSettingsModal}
            disabled={isSyncing}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl border transition active:scale-95 ${
              hasGoogleSheets
                ? 'border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-900 shadow-xs'
                : 'border-amber-300 bg-amber-50/80 text-amber-900 hover:bg-amber-100/70'
            }`}
            title={
              hasGoogleSheets
                ? '구글 시트 연동됨 — 클릭하여 최신 내역 동기화'
                : '구글 시트 연동 설정하기'
            }
          >
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                hasGoogleSheets ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
              }`}
            />
            <RefreshCw className={`w-3.5 h-3.5 ${hasGoogleSheets ? 'text-zinc-700' : 'text-amber-700'} ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="text-[11px] sm:text-xs whitespace-nowrap">
              {isSyncing ? '동기화 중...' : hasGoogleSheets ? '시트 연동됨' : '시트 연동 필요'}
            </span>
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
