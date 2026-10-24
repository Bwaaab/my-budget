import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  QrCode,
  Settings,
  Sparkles,
  Plus,
  Wallet,
  RefreshCw
} from 'lucide-react';

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
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 sm:px-6">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        {/* Brand & Month Navigator */}
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-slate-900 leading-tight">스마트 가계부</h1>
              <span className="text-xs text-indigo-600 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                PC · 구글 시트 · 폰 연동
              </span>
            </div>
          </div>

          {/* Month Selector */}
          <div className="flex items-center bg-slate-100/90 rounded-xl p-1 border border-slate-200/60 shadow-inner">
            <button
              onClick={onPrevMonth}
              className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
              title="이전 달"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2.5 sm:px-3 text-sm font-semibold text-slate-800 tracking-tight min-w-[96px] text-center">
              {year}년 {month}월
            </span>
            <button
              onClick={onNextMonth}
              className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
              title="다음 달"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Google Sheets Sync Button */}
          <button
            onClick={onSyncGoogleSheets}
            disabled={isSyncing}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border transition active:scale-95 ${
              hasGoogleSheets
                ? 'bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 border-emerald-200 shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
            }`}
            title="구글 시트에서 폰으로 입력한 최신 내역 가져오기"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">구글 시트 동기화</span>
          </button>

          {/* QR Code Phone Sync button (desktop/tablet) */}
          <button
            onClick={onOpenQrModal}
            className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition border border-slate-200"
            title="스마트폰 연결 및 모바일 앱 링크"
          >
            <QrCode className="w-4 h-4 text-indigo-600" />
            <span className="hidden lg:inline">스마트폰 연결</span>
          </button>

          {/* Settings button */}
          <button
            onClick={onOpenSettingsModal}
            className={`p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition border border-slate-200 relative ${
              !hasApiKey || !hasGoogleSheets ? 'bg-amber-50 border-amber-300' : 'bg-white'
            }`}
            title="설정 (구글 시트 및 Gemini API 키)"
          >
            <Settings className="w-4 h-4 text-slate-600" />
            {(!hasApiKey || !hasGoogleSheets) && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
            )}
          </button>

          {/* AI Scan Action */}
          <button
            onClick={onOpenScanner}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-xl shadow-md shadow-indigo-200 transition-all active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-yellow-300" />
            <span>AI 캡처 인식</span>
          </button>

          {/* Direct Add Button */}
          <button
            onClick={onOpenAddModal}
            className="hidden sm:flex items-center gap-1 px-3 py-2 text-xs sm:text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100/80 rounded-xl border border-indigo-200/80 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>직접 입력</span>
          </button>
        </div>
      </div>
    </header>
  );
}
