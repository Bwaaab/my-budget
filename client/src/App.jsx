import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import SummaryCards from './components/SummaryCards';
import ChartsView from './components/ChartsView';
import TransactionList from './components/TransactionList';
import AiScannerModal from './components/AiScannerModal';
import TransactionModal from './components/TransactionModal';
import QrCodeModal from './components/QrCodeModal';
import SettingsModal from './components/SettingsModal';
import ReceiptViewerModal from './components/ReceiptViewerModal';
import MobileBottomNav from './components/MobileBottomNav';
import Wishlist from './components/Wishlist';
import { Sparkles, UploadCloud, Smartphone, Wallet, Heart } from 'lucide-react';

// Helper: Client-side stats computation (used on GitHub Pages / Serverless)
function computeClientStats(txList, year, month, monthlyBudget = 1200000) {
  const monthStr = String(month).padStart(2, '0');
  const pattern = `${year}-${monthStr}`;
  const monthlyTx = (txList || []).filter(t => (t.date || '').startsWith(pattern));

  let totalExpense = 0;
  let totalIncome = 0;
  const catMap = {};
  const daysInMonth = new Date(year, month, 0).getDate();
  const dailyMap = {};
  for (let i = 1; i <= daysInMonth; i++) {
    const dayKey = `${pattern}-${String(i).padStart(2, '0')}`;
    dailyMap[dayKey] = { day: String(i), expense: 0, income: 0 };
  }

  for (const t of monthlyTx) {
    const amt = Number(t.amount) || 0;
    if (t.type === 'expense') {
      totalExpense += amt;
      catMap[t.category] = (catMap[t.category] || 0) + amt;
      if (dailyMap[t.date]) dailyMap[t.date].expense += amt;
    } else if (t.type === 'income') {
      totalIncome += amt;
      if (dailyMap[t.date]) dailyMap[t.date].income += amt;
    }
  }

  const balance = totalIncome - totalExpense;
  const remainingBudget = monthlyBudget - totalExpense;
  const budgetPercent = monthlyBudget > 0 ? Math.round((totalExpense / monthlyBudget) * 100) : 0;
  const categories = Object.keys(catMap).map(k => ({
    category: k,
    amount: catMap[k],
    percentage: totalExpense > 0 ? Math.round((catMap[k] / totalExpense) * 100) : 0
  })).sort((a, b) => b.amount - a.amount);

  return {
    year,
    month,
    totalExpense,
    totalIncome,
    balance,
    monthlyBudget,
    remainingBudget,
    budgetPercent,
    categories,
    dailyTrend: Object.values(dailyMap)
  };
}

export default function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState(null);
  const [networkInfo, setNetworkInfo] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Modals & UI States
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [viewingReceiptPath, setViewingReceiptPath] = useState('');
  const [editingTx, setEditingTx] = useState(null);
  const [initialFileForScanner, setInitialFileForScanner] = useState(null);
  const [currentView, setCurrentView] = useState('budget'); // 'budget' | 'wishlist'

  const [activeMobileTab, setActiveMobileTab] = useState('overview');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // 1. Fetch Transactions
  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch(`/api/transactions?year=${year}&month=${month}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
        return;
      }
    } catch (_) {}

    // Fallback: LocalStorage / Serverless
    const saved = localStorage.getItem('budget_local_transactions');
    const list = saved ? JSON.parse(saved) : [];
    setTransactions(list);
  }, [year, month]);

  // 2. Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/stats/monthly?year=${year}&month=${month}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        return;
      }
    } catch (_) {}

    // Fallback: Compute client-side
    const saved = localStorage.getItem('budget_local_transactions');
    const list = saved ? JSON.parse(saved) : [];
    const b = Number(localStorage.getItem('budget_monthly_target')) || 1200000;
    setStats(computeClientStats(list, year, month, b));
  }, [year, month]);

  // 3. Fetch Settings
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        if (data.gemini_api_key) localStorage.setItem('budget_gemini_key', data.gemini_api_key);
        if (data.google_sheets_url) localStorage.setItem('budget_sheets_url', data.google_sheets_url);
        return;
      }
    } catch (_) {}

    // Fallback: LocalStorage
    const key = localStorage.getItem('budget_gemini_key') || '';
    const sheets = localStorage.getItem('budget_sheets_url') || '';
    const b = Number(localStorage.getItem('budget_monthly_target')) || 1200000;
    setSettings({
      gemini_api_key: key,
      hasApiKey: !!key,
      monthly_budget: b,
      google_sheets_url: sheets
    });
  }, []);

  // 4. Fetch Network Info for QR Code
  const fetchNetworkInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/network-info');
      if (res.ok) {
        const data = await res.json();
        setNetworkInfo(data);
      }
    } catch (err) {
      console.error('Failed to fetch network info:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchTransactions();
    fetchStats();
    fetchSettings();
    fetchNetworkInfo();
  }, [fetchTransactions, fetchStats, fetchSettings, fetchNetworkInfo]);

  // Month navigation
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, currentDate.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate(new Date(year, currentDate.getMonth() + 1, 1));
  };

  // Global Clipboard Paste (Ctrl+V) listener
  useEffect(() => {
    const handlePaste = (e) => {
      // Don't capture if focused on input/textarea
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            e.preventDefault();
            setInitialFileForScanner(blob);
            setIsScannerOpen(true);
            showToast('📋 클립보드 캡처 이미지를 감지하여 AI 분석을 시작합니다!');
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Global Drag & Drop listener
  useEffect(() => {
    const handleDragEnter = (e) => {
      e.preventDefault();
      setIsDraggingOver(true);
    };
    const handleDragLeave = (e) => {
      if (e.relatedTarget === null) {
        setIsDraggingOver(false);
      }
    };
    const handleDragOver = (e) => e.preventDefault();
    const handleDrop = (e) => {
      e.preventDefault();
      setIsDraggingOver(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('image/')) {
          setInitialFileForScanner(file);
          setIsScannerOpen(true);
          showToast('📸 드롭된 이미지를 감지하여 AI 분석을 시작합니다!');
        }
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  // Save Transaction (from Scanner or Manual modal)
  const handleSaveTransaction = async (data) => {
    let savedOnServer = false;
    try {
      const isUpdate = !!data.id;
      const url = isUpdate ? `/api/transactions/${data.id}` : '/api/transactions';
      const method = isUpdate ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        savedOnServer = true;
      }
    } catch (_) {}

    // Also update LocalStorage & Google Sheets (for GitHub Pages / Serverless)
    const saved = localStorage.getItem('budget_local_transactions');
    let list = saved ? JSON.parse(saved) : [];
    if (data.id) {
      list = list.map(item => item.id === data.id ? { ...item, ...data } : item);
    } else {
      const newTx = { ...data, id: Date.now() };
      list.unshift(newTx);
    }
    localStorage.setItem('budget_local_transactions', JSON.stringify(list));
    pushToDrive(list);

    // If Google Sheet is linked, send to Sheet directly
    const sheetsUrl = settings?.google_sheets_url || localStorage.getItem('budget_sheets_url');
    if (sheetsUrl) {
      try {
        fetch(sheetsUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } catch (_) {}
    }

    showToast(data.id ? '✅ 내역이 수정되었습니다!' : '🎉 가계부에 성공적으로 등록되었습니다!');
    fetchTransactions();
    fetchStats();
  };

  // Delete Transaction
  const handleDeleteTransaction = async (id) => {
    if (!confirm('이 내역을 삭제하시겠습니까?')) return;
    try {
      await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    } catch (_) {}

    // Remove from localstorage
    const saved = localStorage.getItem('budget_local_transactions');
    let list = saved ? JSON.parse(saved) : [];
    list = list.filter(t => t.id !== id);
    localStorage.setItem('budget_local_transactions', JSON.stringify(list));
    pushToDrive(list);

    showToast('🗑️ 내역이 삭제되었습니다.');
    fetchTransactions();
    fetchStats();
  };

  // Save Settings
  const handleSaveSettings = async (newSettings) => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
    } catch (_) {}

    // Always persist to localstorage
    if (newSettings.gemini_api_key) localStorage.setItem('budget_gemini_key', newSettings.gemini_api_key);
    if (newSettings.google_sheets_url) localStorage.setItem('budget_sheets_url', newSettings.google_sheets_url);
    if (newSettings.monthly_budget) {
      localStorage.setItem('budget_monthly_target', String(newSettings.monthly_budget));
      const sheetsUrl = newSettings.google_sheets_url || localStorage.getItem('budget_sheets_url');
      if (sheetsUrl) {
        try {
          fetch(sheetsUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update_budget',
              monthly_budget: newSettings.monthly_budget
            })
          });
        } catch (_) {}
      }
    }

    fetchSettings();
    fetchStats();
    showToast('⚙️ 설정이 안전하게 저장되었습니다.');
  };

  // Sync Wishlist to Google Sheets
  const handleSyncWishlist = (wishlistItems) => {
    const sheetsUrl = settings?.google_sheets_url || localStorage.getItem('budget_sheets_url');
    if (sheetsUrl) {
      try {
        fetch(sheetsUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sync_wishlist',
            wishlist: wishlistItems
          })
        });
      } catch (_) {}
    }
  };

  // Google Sheets Full Sync (Transactions + Wishlist + Budget)
  const handleSyncGoogleSheets = async () => {
    const sheetsUrl = settings?.google_sheets_url || localStorage.getItem('budget_sheets_url');
    if (!sheetsUrl) {
      setIsSettingsModalOpen(true);
      showToast('⚙️ 먼저 구글 시트 연동 URL을 등록해 주세요.');
      return;
    }

    setIsSyncing(true);
    try {
      const res = await fetch(sheetsUrl);
      const data = await res.json();

      let txCount = 0;
      let wishCount = 0;

      if (data && typeof data === 'object' && !Array.isArray(data)) {
        if (Array.isArray(data.transactions)) {
          setTransactions(data.transactions);
          localStorage.setItem('budget_local_transactions', JSON.stringify(data.transactions));
          txCount = data.transactions.length;
        }
        if (Array.isArray(data.wishlist)) {
          localStorage.setItem('budget_wishlist', JSON.stringify(data.wishlist));
          wishCount = data.wishlist.length;
        }
        if (data.settings && data.settings.monthly_budget) {
          localStorage.setItem('budget_monthly_target', String(data.settings.monthly_budget));
          setSettings(prev => ({ ...prev, monthly_budget: data.settings.monthly_budget }));
        }
      } else if (Array.isArray(data)) {
        setTransactions(data);
        localStorage.setItem('budget_local_transactions', JSON.stringify(data));
        txCount = data.length;
      }

      fetchTransactions();
      fetchStats();
      showToast(`🎉 구글 시트 동기화 완료! (지출 ${txCount}건, 위시리스트 ${wishCount}건)`);
    } catch (err) {
      alert('구글 시트 동기화 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50/80 pb-24 md:pb-12 relative flex flex-col font-sans text-zinc-800 w-full max-w-full overflow-x-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg border border-zinc-700 animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* Fullscreen Drag Overlay */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-50 bg-zinc-900/80 backdrop-blur-xs flex flex-col items-center justify-center text-white pointer-events-none border-2 border-dashed border-zinc-400">
          <UploadCloud className="w-12 h-12 text-zinc-300 mb-2" />
          <h2 className="text-base font-bold">영수증/캡처 이미지를 여기에 놓으세요</h2>
          <p className="text-xs text-zinc-400 mt-1">AI가 지출 내역을 자동 분석합니다</p>
        </div>
      )}

      {/* Top Header */}
      <Header
        currentDate={currentDate}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onOpenScanner={() => {
          setInitialFileForScanner(null);
          setIsScannerOpen(true);
        }}
        onOpenAddModal={() => {
          setEditingTx(null);
          setIsTxModalOpen(true);
        }}
        onOpenQrModal={() => setIsQrModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onSyncGoogleSheets={handleSyncGoogleSheets}
        isSyncing={isSyncing}
        hasApiKey={settings?.hasApiKey}
        hasGoogleSheets={!!settings?.google_sheets_url}
      />

      {/* Main Content Container */}
      <main className="max-w-5xl w-full mx-auto px-3 sm:px-6 pt-3 sm:pt-4 space-y-3 sm:space-y-4 flex-1 overflow-x-hidden">
        {/* View Switcher Tabs (PC & Tablet) */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex bg-zinc-200/60 p-0.5 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setCurrentView('budget')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                currentView === 'budget'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>가계부</span>
            </button>
            <button
              onClick={() => setCurrentView('wishlist')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                currentView === 'wishlist'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${currentView === 'wishlist' ? 'fill-zinc-800' : ''}`} />
              <span>위시리스트</span>
            </button>
          </div>
        </div>

        {currentView === 'wishlist' || activeMobileTab === 'wishlist' ? (
          <Wishlist
            remainingBudget={stats?.remainingBudget || 0}
            onConvertToExpense={handleSaveTransaction}
            onSyncWishlist={handleSyncWishlist}
          />
        ) : (
          <>
            {/* 1. Monthly Overview Cards */}
            <SummaryCards
              stats={stats}
              onOpenBudgetEdit={() => setIsSettingsModalOpen(true)}
            />

            {/* 2. Visual Charts (Category donut + Daily trend) */}
            <ChartsView stats={stats} />

            {/* 3. Detailed Transactions Section */}
            <div id="transaction-section">
              <TransactionList
                transactions={transactions}
                onEdit={(tx) => {
                  setEditingTx(tx);
                  setIsTxModalOpen(true);
                }}
                onDelete={handleDeleteTransaction}
                onViewReceipt={(path) => setViewingReceiptPath(path)}
                onOpenScanner={() => {
                  setInitialFileForScanner(null);
                  setIsScannerOpen(true);
                }}
                onOpenAddModal={() => {
                  setEditingTx(null);
                  setIsTxModalOpen(true);
                }}
              />
            </div>
          </>
        )}
      </main>

      {/* Modals */}
      <AiScannerModal
        isOpen={isScannerOpen}
        onClose={() => {
          setIsScannerOpen(false);
          setInitialFileForScanner(null);
        }}
        onSaveTransaction={handleSaveTransaction}
        hasApiKey={settings?.hasApiKey}
        onSaveApiKey={(key) => handleSaveSettings({ gemini_api_key: key })}
        initialFile={initialFileForScanner}
      />

      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => {
          setIsTxModalOpen(false);
          setEditingTx(null);
        }}
        onSave={handleSaveTransaction}
        onDelete={handleDeleteTransaction}
        initialData={editingTx}
      />

      <QrCodeModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        networkInfo={networkInfo}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        onRefreshData={() => {
          fetchTransactions();
          fetchStats();
        }}
        onSyncGoogleSheets={handleSyncGoogleSheets}
      />

      <ReceiptViewerModal
        isOpen={!!viewingReceiptPath}
        onClose={() => setViewingReceiptPath('')}
        imagePath={viewingReceiptPath}
      />

      {/* Mobile Fixed Bottom Navigation */}
      <MobileBottomNav
        activeTab={activeMobileTab}
        setActiveTab={setActiveMobileTab}
        onOpenScanner={() => {
          setInitialFileForScanner(null);
          setIsScannerOpen(true);
        }}
        onOpenQrModal={() => setIsQrModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
      />
    </div>
  );
}
