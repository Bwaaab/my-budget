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

// Helper: Send POST payload to Google Apps Script Web App
async function postToGoogleSheets(sheetsUrl, payload) {
  if (!sheetsUrl || sheetsUrl.includes('/macros/library/')) return;
  const body = JSON.stringify(payload);
  try {
    await fetch(sheetsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body
    });
  } catch (_) {
    try {
      await fetch(sheetsUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body
      });
    } catch (__) {}
  }
}

export default function App() {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Initialize directly from localStorage so UI is instant and never flashes unlinked state
  const [transactions, setTransactions] = useState(() => {
    try {
      const saved = localStorage.getItem('budget_local_transactions');
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });

  const [wishlist, setWishlist] = useState(() => {
    try {
      const saved = localStorage.getItem('budget_wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });

  const [settings, setSettings] = useState(() => {
    const key = localStorage.getItem('budget_gemini_key') || '';
    const sheets = localStorage.getItem('budget_sheets_url') || '';
    const b = Number(localStorage.getItem('budget_monthly_target')) || 1200000;
    return {
      gemini_api_key: key,
      hasApiKey: !!key,
      monthly_budget: b,
      google_sheets_url: sheets
    };
  });

  const [stats, setStats] = useState(() => {
    const now = new Date();
    const b = Number(localStorage.getItem('budget_monthly_target')) || 1200000;
    let list = [];
    try {
      const saved = localStorage.getItem('budget_local_transactions');
      list = saved ? JSON.parse(saved) : [];
    } catch (_) {}
    return computeClientStats(list, now.getFullYear(), now.getMonth() + 1, b);
  });

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

  // Keep stats in sync whenever transactions, year, month, or monthly_budget change
  useEffect(() => {
    const b = Number(settings?.monthly_budget) || Number(localStorage.getItem('budget_monthly_target')) || 1200000;
    const monthStr = String(month).padStart(2, '0');
    const pattern = `${year}-${monthStr}`;
    let allTx = transactions;
    try {
      const saved = localStorage.getItem('budget_local_transactions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.length > allTx.length) allTx = parsed;
      }
    } catch (_) {}
    setStats(computeClientStats(allTx, year, month, b));
  }, [transactions, year, month, settings?.monthly_budget]);

  // 1. Fetch Transactions (Merges localStorage & optional local server)
  const fetchTransactions = useCallback(async () => {
    const hasSheets = !!(localStorage.getItem('budget_sheets_url'));
    let localList = [];
    try {
      const saved = localStorage.getItem('budget_local_transactions');
      localList = saved ? JSON.parse(saved) : [];
    } catch (_) {}

    if (!hasSheets) {
      try {
        const res = await fetch(`/api/transactions?year=${year}&month=${month}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0 && localList.length === 0) {
            setTransactions(data);
            localStorage.setItem('budget_local_transactions', JSON.stringify(data));
            return;
          }
        }
      } catch (_) {}
    }

    const monthStr = String(month).padStart(2, '0');
    const pattern = `${year}-${monthStr}`;
    const filtered = localList.filter(t => !t.date || t.date.startsWith(pattern));
    setTransactions(filtered);
  }, [year, month]);

  // 2. Fetch Stats
  const fetchStats = useCallback(async () => {
    let localList = [];
    try {
      const saved = localStorage.getItem('budget_local_transactions');
      localList = saved ? JSON.parse(saved) : [];
    } catch (_) {}
    const b = Number(localStorage.getItem('budget_monthly_target')) || Number(settings?.monthly_budget) || 1200000;
    setStats(computeClientStats(localList, year, month, b));
  }, [year, month, settings?.monthly_budget]);

  // 3. Fetch Settings (Never overwrites localStorage with empty server values)
  const fetchSettings = useCallback(async () => {
    let key = localStorage.getItem('budget_gemini_key') || '';
    let sheets = localStorage.getItem('budget_sheets_url') || '';
    let b = Number(localStorage.getItem('budget_monthly_target')) || 0;

    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        if (!key && data.gemini_api_key && !data.gemini_api_key.includes('...')) {
          key = data.gemini_api_key;
          localStorage.setItem('budget_gemini_key', key);
        }
        if (!sheets && data.google_sheets_url) {
          sheets = data.google_sheets_url;
          localStorage.setItem('budget_sheets_url', sheets);
        }
        if (!b && data.monthly_budget) {
          b = Number(data.monthly_budget);
          localStorage.setItem('budget_monthly_target', String(b));
        }
        // If localStorage has values that server doesn't have yet, push to server
        if (sheets || b) {
          fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              google_sheets_url: sheets,
              monthly_budget: b || 1200000
            })
          }).catch(() => {});
        }
      }
    } catch (_) {}

    if (!b) b = 1200000;
    setSettings(prev => ({
      ...prev,
      gemini_api_key: key || prev?.gemini_api_key || '',
      hasApiKey: !!(key || prev?.hasApiKey),
      monthly_budget: b,
      google_sheets_url: sheets
    }));
  }, []);

  // 4. Fetch Network Info for QR Code
  const fetchNetworkInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/network-info');
      if (res.ok) {
        const data = await res.json();
        setNetworkInfo(data);
      }
    } catch (_) {}
  }, []);

  // Google Sheets Full Sync (Transactions + Wishlist + Budget)
  const handleSyncGoogleSheets = useCallback(async (overrideUrl, overrideLocalBudget, silent = false) => {
    const sheetsUrl = (overrideUrl || localStorage.getItem('budget_sheets_url') || settings?.google_sheets_url || '').trim();
    if (!sheetsUrl || sheetsUrl.includes('/macros/library/')) {
      if (!silent) {
        setIsSettingsModalOpen(true);
        showToast('⚙️ 먼저 올바른 구글 시트 웹 앱 URL(/exec)을 등록해 주세요.');
      }
      return;
    }

    setIsSyncing(true);
    try {
      const res = await fetch(`${sheetsUrl}${sheetsUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      let txCount = 0;
      let wishCount = 0;
      const localBudget = Number(overrideLocalBudget) || Number(localStorage.getItem('budget_monthly_target')) || 0;

      if (data && typeof data === 'object' && !Array.isArray(data)) {
        // 1. Transactions
        if (Array.isArray(data.transactions)) {
          let localTx = [];
          try {
            localTx = JSON.parse(localStorage.getItem('budget_local_transactions') || '[]');
          } catch (_) {}

          if (data.transactions.length === 0 && localTx.length > 0) {
            // Sheet is empty but device has local transactions -> push local transactions to sheet
            for (const tx of localTx) {
              await postToGoogleSheets(sheetsUrl, { action: 'add_transaction', ...tx });
            }
            txCount = localTx.length;
          } else {
            localStorage.setItem('budget_local_transactions', JSON.stringify(data.transactions));
            const monthStr = String(month).padStart(2, '0');
            const pattern = `${year}-${monthStr}`;
            setTransactions(data.transactions.filter(t => !t.date || t.date.startsWith(pattern)));
            txCount = data.transactions.length;
          }
        }

        // 2. Wishlist
        if (Array.isArray(data.wishlist)) {
          let localWish = [];
          try {
            localWish = JSON.parse(localStorage.getItem('budget_wishlist') || '[]');
          } catch (_) {}

          if (data.wishlist.length === 0 && localWish.length > 0) {
            await postToGoogleSheets(sheetsUrl, { action: 'sync_wishlist', wishlist: localWish });
            wishCount = localWish.length;
          } else {
            setWishlist(data.wishlist);
            localStorage.setItem('budget_wishlist', JSON.stringify(data.wishlist));
            wishCount = data.wishlist.length;
          }
        }

        // 3. Monthly Budget Target
        const sheetBudget = Number(data.settings?.monthly_budget) || 0;
        let finalBudget = 1200000;

        if (overrideLocalBudget && Number(overrideLocalBudget) !== 1200000) {
          // User explicitly saved/tested with a specific budget on this device -> push to sheet
          finalBudget = Number(overrideLocalBudget);
          await postToGoogleSheets(sheetsUrl, { action: 'update_budget', monthly_budget: finalBudget });
        } else if (sheetBudget && sheetBudget !== 1200000) {
          // Sheet has a custom budget (e.g. 400,000 set from PC) -> adopt on Phone/PC!
          finalBudget = sheetBudget;
        } else if (localBudget && localBudget !== 1200000 && (!sheetBudget || sheetBudget === 1200000)) {
          // Local device has custom budget (e.g. 400,000) while sheet still has default 1,200,000 -> push local to sheet!
          finalBudget = localBudget;
          await postToGoogleSheets(sheetsUrl, { action: 'update_budget', monthly_budget: finalBudget });
        } else if (sheetBudget) {
          finalBudget = sheetBudget;
        } else if (localBudget) {
          finalBudget = localBudget;
        }

        localStorage.setItem('budget_monthly_target', String(finalBudget));
        setSettings(prev => ({
          ...prev,
          monthly_budget: finalBudget,
          google_sheets_url: sheetsUrl
        }));
      } else if (Array.isArray(data)) {
        localStorage.setItem('budget_local_transactions', JSON.stringify(data));
        const monthStr = String(month).padStart(2, '0');
        const pattern = `${year}-${monthStr}`;
        setTransactions(data.filter(t => !t.date || t.date.startsWith(pattern)));
        txCount = data.length;
      }

      fetchStats();
      if (!silent) {
        showToast(`🎉 구글 시트 동기화 완료! (내역 ${txCount}건, 위시리스트 ${wishCount}건)`);
      }
    } catch (err) {
      if (!silent) {
        showToast('⚠️ 구글 시트 동기화 실패: URL을 확인해 주세요.');
      }
    } finally {
      setIsSyncing(false);
    }
  }, [month, year, settings?.google_sheets_url, fetchStats]);

  // Initial load + Auto-sync from Google Sheets on startup & tab focus
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sheetFromUrl = urlParams.get('sheet');
    if (sheetFromUrl && !sheetFromUrl.includes('/macros/library/')) {
      localStorage.setItem('budget_sheets_url', sheetFromUrl.trim());
      setSettings(prev => ({ ...prev, google_sheets_url: sheetFromUrl.trim() }));
      window.history.replaceState({}, document.title, window.location.pathname);
      showToast('🔗 구글 시트가 자동 연결되었습니다!');
    }

    fetchTransactions();
    fetchStats();
    fetchSettings();
    fetchNetworkInfo();

    const activeSheet = (sheetFromUrl || localStorage.getItem('budget_sheets_url') || '').trim();
    if (activeSheet && !activeSheet.includes('/macros/library/')) {
      handleSyncGoogleSheets(activeSheet, null, !sheetFromUrl);
    }

    // Auto-sync whenever user returns to the app/tab on mobile or PC
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        const currentSheet = (localStorage.getItem('budget_sheets_url') || '').trim();
        if (currentSheet && !currentSheet.includes('/macros/library/')) {
          handleSyncGoogleSheets(currentSheet, null, true);
        }
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-filter transactions when month/year changes
  useEffect(() => {
    fetchTransactions();
    fetchStats();
  }, [year, month, fetchTransactions, fetchStats]);

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
    const isUpdate = !!data.id;
    try {
      const url = isUpdate ? `/api/transactions/${data.id}` : '/api/transactions';
      const method = isUpdate ? 'PUT' : 'POST';
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (_) {}

    // Update LocalStorage & state immediately
    let list = [];
    try {
      const saved = localStorage.getItem('budget_local_transactions');
      list = saved ? JSON.parse(saved) : [];
    } catch (_) {}

    const txWithId = isUpdate ? data : { ...data, id: Date.now() };
    if (isUpdate) {
      list = list.map(item => item.id === data.id ? { ...item, ...data } : item);
    } else {
      list.unshift(txWithId);
    }
    localStorage.setItem('budget_local_transactions', JSON.stringify(list));

    const monthStr = String(month).padStart(2, '0');
    const pattern = `${year}-${monthStr}`;
    setTransactions(list.filter(t => !t.date || t.date.startsWith(pattern)));
    fetchStats();
    showToast(isUpdate ? '✅ 내역이 수정되었습니다!' : '🎉 가계부에 성공적으로 등록되었습니다!');

    // Sync to Google Sheets
    const sheetsUrl = (settings?.google_sheets_url || localStorage.getItem('budget_sheets_url') || '').trim();
    if (sheetsUrl) {
      if (isUpdate) {
        await postToGoogleSheets(sheetsUrl, { action: 'sync_transactions', transactions: list });
      } else {
        await postToGoogleSheets(sheetsUrl, { action: 'add_transaction', ...txWithId });
      }
    }
  };

  // Delete Transaction
  const handleDeleteTransaction = async (id) => {
    if (!confirm('이 내역을 삭제하시겠습니까?')) return;
    try {
      await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    } catch (_) {}

    // Remove from localstorage
    let list = [];
    try {
      const saved = localStorage.getItem('budget_local_transactions');
      list = saved ? JSON.parse(saved) : [];
    } catch (_) {}
    list = list.filter(t => t.id !== id);
    localStorage.setItem('budget_local_transactions', JSON.stringify(list));

    const monthStr = String(month).padStart(2, '0');
    const pattern = `${year}-${monthStr}`;
    setTransactions(list.filter(t => !t.date || t.date.startsWith(pattern)));
    fetchStats();
    showToast('🗑️ 내역이 삭제되었습니다.');

    const sheetsUrl = (settings?.google_sheets_url || localStorage.getItem('budget_sheets_url') || '').trim();
    if (sheetsUrl) {
      await postToGoogleSheets(sheetsUrl, { action: 'sync_transactions', transactions: list });
    }
  };

  // Save Settings
  const handleSaveSettings = async (newSettings) => {
    const cleanSheetsUrl = newSettings.google_sheets_url !== undefined
      ? newSettings.google_sheets_url.trim()
      : (localStorage.getItem('budget_sheets_url') || settings?.google_sheets_url || '').trim();

    const newBudget = newSettings.monthly_budget !== undefined
      ? Number(newSettings.monthly_budget)
      : (Number(localStorage.getItem('budget_monthly_target')) || settings?.monthly_budget || 1200000);

    // Always persist to localstorage first
    if (newSettings.gemini_api_key) {
      localStorage.setItem('budget_gemini_key', newSettings.gemini_api_key.trim());
    }
    if (newSettings.google_sheets_url !== undefined) {
      localStorage.setItem('budget_sheets_url', cleanSheetsUrl);
    }
    if (newBudget > 0) {
      localStorage.setItem('budget_monthly_target', String(newBudget));
    }

    // Immediately update local React state
    setSettings(prev => ({
      ...prev,
      gemini_api_key: newSettings.gemini_api_key !== undefined ? newSettings.gemini_api_key : prev?.gemini_api_key,
      hasApiKey: !!(newSettings.gemini_api_key || prev?.hasApiKey || localStorage.getItem('budget_gemini_key')),
      google_sheets_url: cleanSheetsUrl,
      monthly_budget: newBudget
    }));

    // Update stats immediately with new budget
    let localList = [];
    try {
      const saved = localStorage.getItem('budget_local_transactions');
      localList = saved ? JSON.parse(saved) : [];
    } catch (_) {}
    setStats(computeClientStats(localList, year, month, newBudget));

    // Also update local server if running
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newSettings,
          google_sheets_url: cleanSheetsUrl,
          monthly_budget: newBudget
        })
      });
    } catch (_) {}

    // Push budget to Google Sheets and await completion
    if (cleanSheetsUrl && !cleanSheetsUrl.includes('/macros/library/')) {
      await postToGoogleSheets(cleanSheetsUrl, {
        action: 'update_budget',
        monthly_budget: newBudget
      });
    }

    showToast('⚙️ 설정이 안전하게 저장되었습니다.');
  };

  // Sync Wishlist to Google Sheets
  const handleSyncWishlist = async (wishlistItems) => {
    setWishlist(wishlistItems);
    localStorage.setItem('budget_wishlist', JSON.stringify(wishlistItems));
    const sheetsUrl = (settings?.google_sheets_url || localStorage.getItem('budget_sheets_url') || '').trim();
    if (sheetsUrl) {
      await postToGoogleSheets(sheetsUrl, {
        action: 'sync_wishlist',
        wishlist: wishlistItems
      });
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
        onSyncGoogleSheets={() => handleSyncGoogleSheets()}
        isSyncing={isSyncing}
        hasApiKey={settings?.hasApiKey}
        hasGoogleSheets={!!(settings?.google_sheets_url || localStorage.getItem('budget_sheets_url'))}
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
            items={wishlist}
            onUpdateItems={setWishlist}
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
        googleSheetsUrl={settings?.google_sheets_url}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
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
