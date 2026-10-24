import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  Sparkles,
  QrCode,
  Settings
} from 'lucide-react';

export default function MobileBottomNav({
  activeTab,
  setActiveTab,
  onOpenScanner,
  onOpenQrModal,
  onOpenSettingsModal
}) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-1.5 flex items-center justify-around shadow-lg">
      {/* Dashboard Tab */}
      <button
        onClick={() => {
          setActiveTab('overview');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition ${
          activeTab === 'overview' ? 'text-indigo-600 font-bold' : 'text-slate-400'
        }`}
      >
        <LayoutDashboard className="w-5 h-5" />
        <span className="text-[10px]">대시보드</span>
      </button>

      {/* Transactions Tab */}
      <button
        onClick={() => {
          setActiveTab('transactions');
          const el = document.getElementById('transaction-section');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
        className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition ${
          activeTab === 'transactions' ? 'text-indigo-600 font-bold' : 'text-slate-400'
        }`}
      >
        <Receipt className="w-5 h-5" />
        <span className="text-[10px]">상세내역</span>
      </button>

      {/* Center AI Scan Button */}
      <button
        onClick={onOpenScanner}
        className="-mt-5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg shadow-indigo-300 active:scale-90 transition border-2 border-white"
        title="AI 캡처 인식"
      >
        <Sparkles className="w-6 h-6 text-yellow-300" />
      </button>

      {/* QR Sync */}
      <button
        onClick={onOpenQrModal}
        className="flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl text-slate-400 hover:text-slate-600 transition"
      >
        <QrCode className="w-5 h-5" />
        <span className="text-[10px]">폰 연동</span>
      </button>

      {/* Settings */}
      <button
        onClick={onOpenSettingsModal}
        className="flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl text-slate-400 hover:text-slate-600 transition"
      >
        <Settings className="w-5 h-5" />
        <span className="text-[10px]">설정</span>
      </button>
    </div>
  );
}
