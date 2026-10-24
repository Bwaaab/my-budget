import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  Sparkles,
  Heart,
  Settings
} from 'lucide-react';

export default function MobileBottomNav({
  activeTab,
  setActiveTab,
  onOpenScanner,
  onOpenSettingsModal
}) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-zinc-200/80 px-2 py-1.5 flex items-center justify-around shadow-xs">
      {/* Dashboard Tab */}
      <button
        onClick={() => {
          setActiveTab('overview');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition ${
          activeTab === 'overview' ? 'text-zinc-950 font-bold' : 'text-zinc-400'
        }`}
      >
        <LayoutDashboard className="w-4 h-4" />
        <span className="text-[10px] tracking-tight">대시보드</span>
      </button>

      {/* Transactions Tab */}
      <button
        onClick={() => {
          setActiveTab('transactions');
          const el = document.getElementById('transaction-section');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
        className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition ${
          activeTab === 'transactions' ? 'text-zinc-950 font-bold' : 'text-zinc-400'
        }`}
      >
        <Receipt className="w-4 h-4" />
        <span className="text-[10px] tracking-tight">상세내역</span>
      </button>

      {/* Center AI Scan Button (Minimalist Black & White) */}
      <button
        onClick={onOpenScanner}
        className="-mt-5 bg-zinc-900 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-md active:scale-90 transition border-2 border-white flex-shrink-0"
        title="AI 캡처 인식"
      >
        <Sparkles className="w-5 h-5 text-white" />
      </button>

      {/* Wishlist Tab */}
      <button
        onClick={() => {
          setActiveTab('wishlist');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition ${
          activeTab === 'wishlist' ? 'text-zinc-950 font-bold' : 'text-zinc-400'
        }`}
      >
        <Heart className={`w-4 h-4 ${activeTab === 'wishlist' ? 'fill-zinc-900' : ''}`} />
        <span className="text-[10px] tracking-tight">위시리스트</span>
      </button>

      {/* Settings */}
      <button
        onClick={onOpenSettingsModal}
        className="flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl text-zinc-400 hover:text-zinc-900 transition"
      >
        <Settings className="w-4 h-4" />
        <span className="text-[10px] tracking-tight">설정</span>
      </button>
    </div>
  );
}
