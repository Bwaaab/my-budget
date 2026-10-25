import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import SummaryCards from './components/SummaryCards';
import ChartsView from './components/ChartsView';
import TransactionList from './components/TransactionList';
import AiScannerModal from './components/AiScannerModal';
import WishlistAiScannerModal from './components/WishlistAiScannerModal';
import TransactionModal from './components/TransactionModal';
import QrCodeModal from './components/QrCodeModal';
import SettingsModal from './components/SettingsModal';
import ReceiptViewerModal from './components/ReceiptViewerModal';
import MobileBottomNav from './components/MobileBottomNav';
import Wishlist from './components/Wishlist';
import { Sparkles, UploadCloud, Smartphone, Wallet, Heart } from 'lucide-react';
import { normalizeDateYMD, normalizeTimeHM, isSavingTx, getNecessity, cleanNumber } from './constants';

// Helper: Client-side stats computation (used on GitHub Pages / Serverless)
function computeClientStats(txList, year, month, monthlyBudget = 1200000) {
  const monthStr = String(month).padStart(2, '0');
  const pattern = `${year}-${monthStr}`;
  const allTx = txList || [];
  const monthlyTx = allTx.filter(t => normalizeDateYMD(t.date).startsWith(pattern));

  let totalExpense = 0;
  let totalNeedExpense = 0;
  let totalWantExpense = 0;
  let totalIncome = 0;
  let totalSaving = 0;
  let allTimeSaving = 0;

  for (const t of allTx) {
    if (isSavingTx(t)) {
      allTimeSaving += Number(t.amount) || 0;
    }
  }

  const catMap = {};
  const daysInMonth = new Date(year, month, 0).getDate();
  const dailyMap = {};
  for (let i = 1; i <= daysInMonth; i++) {
    const dayKey = `${pattern}-${String(i).padStart(2, '0')}`;
    dailyMap[dayKey] = { day: String(i), expense: 0, income: 0, saving: 0 };
  }

  for (const t of monthlyTx) {
    const amt = Number(t.amount) || 0;
    const cleanDate = normalizeDateYMD(t.date);
    if (isSavingTx(t)) {
      totalSaving += amt;
      if (dailyMap[cleanDate]) dailyMap[cleanDate].saving += amt;
    } else if (t.type === 'expense') {
      totalExpense += amt;
      const nec = getNecessity(t);
      if (nec === 'want') {
        totalWantExpense += amt;
      } else {
        totalNeedExpense += amt;
      }
      catMap[t.category] = (catMap[t.category] || 0) + amt;
      if (dailyMap[cleanDate]) dailyMap[cleanDate].expense += amt;
    } else if (t.type === 'income') {
      totalIncome += amt;
      if (dailyMap[cleanDate]) dailyMap[cleanDate].income += amt;
    }
  }

  // Cash left to spend right now = Income - Expense - Saving
  const balance = totalIncome - totalExpense - totalSaving;
  const remainingBudget = monthlyBudget - totalExpense;
  const budgetPercent = monthlyBudget > 0 ? Math.round((totalExpense / monthlyBudget) * 100) : 0;
  const needPercent = totalExpense > 0 ? Math.round((totalNeedExpense / totalExpense) * 100) : 0;
  const wantPercent = totalExpense > 0 ? Math.round((totalWantExpense / totalExpense) * 100) : 0;
  const categories = Object.keys(catMap).map(k => ({
    category: k,
    amount: catMap[k],
    percentage: totalExpense > 0 ? Math.round((catMap[k] / totalExpense) * 100) : 0
  })).sort((a, b) => b.amount - a.amount);

  return {
    year,
    month,
    totalExpense,
    totalNeedExpense,
    totalWantExpense,
    needPercent,
    wantPercent,
    totalIncome,
    totalSaving,
    allTimeSaving,
    balance,
    monthlyBudget,
    remainingBudget,
    budgetPercent,
    categories,
    dailyTrend: Object.values(dailyMap)
  };
}

// Helper: Serialized POST queue to Google Apps Script Web App (prevents read-before-write race conditions)
let activeWritePromise = Promise.resolve();
let lastWriteTimestamp = 0;
let writeRevision = 0;

async function postToGoogleSheets(sheetsUrl, payload) {
  if (!sheetsUrl || sheetsUrl.includes('/macros/library/')) return;
  writeRevision++;
  lastWriteTimestamp = Date.now();
  const body = JSON.stringify(payload);

  const task = activeWritePromise.then(async () => {
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
    } finally {
      lastWriteTimestamp = Date.now();
    }
  });

  activeWritePromise = task.catch(() => {});
  return task;
}

// Helper: Ensure wishlist payload only contains clean wishlist items (no system config rows)
function buildSyncedWishlistPayload(wishlistItems) {
  return (wishlistItems || []).filter(
    w => w && w.id !== '__SYS_CONFIG__' && w.title !== '__SYS_CONFIG__'
  );
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
  const [isWishlistScannerOpen, setIsWishlistScannerOpen] = useState(false);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [viewingReceiptPath, setViewingReceiptPath] = useState('');
  const [editingTx, setEditingTx] = useState(null);
  const [initialFileForScanner, setInitialFileForScanner] = useState(null);
  const [initialFileForWishlistScanner, setInitialFileForWishlistScanner] = useState(null);
  const [currentView, setCurrentView] = useState('budget'); // 'budget' | 'wishlist'

  const [activeMobileTab, setActiveMobileTab] = useState('overview');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // PWA App Installation state (for mobile Chrome / Safari)
  const [deferredPrompt, setDeferredPrompt] = useState(() => window.__deferredPwaPrompt || null);
  const [isStandalone, setIsStandalone] = useState(() => {
    return (
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator?.standalone === true
    );
  });
  const [hideInstallBanner, setHideInstallBanner] = useState(() => {
    return sessionStorage.getItem('budget_hide_pwa_banner') === '1';
  });
  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState(false);

  useEffect(() => {
    const onPromptReady = () => {
      if (window.__deferredPwaPrompt) {
        setDeferredPrompt(window.__deferredPwaPrompt);
      }
    };
    const onBeforeInstall = (e) => {
      e.preventDefault();
      window.__deferredPwaPrompt = e;
      setDeferredPrompt(e);
    };
    const onAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      window.__deferredPwaPrompt = null;
      showToast('🎉 가계부 앱이 홈 화면에 설치되었습니다!');
    };

    window.addEventListener('pwa-prompt-ready', onPromptReady);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('pwa-prompt-ready', onPromptReady);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const handleInstallPwa = async () => {
    const promptEvent = deferredPrompt || window.__deferredPwaPrompt;
    if (promptEvent) {
      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        window.__deferredPwaPrompt = null;
      }
    } else {
      setIsInstallGuideOpen(true);
    }
  };

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
    const filtered = localList.filter(t => normalizeDateYMD(t.date).startsWith(pattern));
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

    if (silent && Date.now() - lastWriteTimestamp < 6000) {
      return;
    }

    setIsSyncing(true);
    try {
      // Wait for any pending delete/update/add POST to finish on Google Sheets first
      await activeWritePromise;
      const startRevision = writeRevision;

      const res = await fetch(`${sheetsUrl}${sheetsUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // If user performed a write/add/delete while GET was in flight, discard stale GET response
      if (writeRevision !== startRevision) {
        return;
      }

      let txCount = 0;
      let wishCount = 0;
      const localBudget = Number(overrideLocalBudget) || Number(localStorage.getItem('budget_monthly_target')) || 0;

      if (data && typeof data === 'object' && !Array.isArray(data)) {
        // 1. Transactions — Google Sheets is the Single Source of Truth (respects deletions)
        if (Array.isArray(data.transactions)) {
          const normalizedTx = data.transactions.map(t => {
            const saving = isSavingTx(t);
            return {
              ...t,
              type: saving ? 'saving' : (t.type || 'expense'),
              category: saving ? '저축/투자' : (t.category || '기타'),
              necessity: saving ? undefined : (t.necessity || getNecessity(t)),
              date: normalizeDateYMD(t.date),
              time: normalizeTimeHM(t.time)
            };
          });
          localStorage.setItem('budget_local_transactions', JSON.stringify(normalizedTx));
          const monthStr = String(month).padStart(2, '0');
          const pattern = `${year}-${monthStr}`;
          setTransactions(normalizedTx.filter(t => normalizeDateYMD(t.date).startsWith(pattern)));
          txCount = normalizedTx.length;
        }

        // 2. Wishlist + Embedded System Config (__SYS_CONFIG__) — Single Source of Truth
        let embeddedConfig = null;
        let cleanWishlist = [];
        if (Array.isArray(data.wishlist)) {
          const sysRow = data.wishlist.find(
            w => w && (w.id === '__SYS_CONFIG__' || w.title === '__SYS_CONFIG__')
          );
          if (sysRow && sysRow.memo) {
            try {
              embeddedConfig = JSON.parse(sysRow.memo);
            } catch (_) {}
          }
          cleanWishlist = data.wishlist
            .filter(w => w && w.id !== '__SYS_CONFIG__' && w.title !== '__SYS_CONFIG__')
            .map(w => ({
              ...w,
              createdAt: normalizeDateYMD(w.createdAt)
            }));

          // One-time recovery of the 2 wishlist items from 2026-10-24 screenshot if one was overwritten by Settings X button
          let recovered = false;
          if (!localStorage.getItem('budget_restored_wish_20261024')) {
            localStorage.setItem('budget_restored_wish_20261024', '1');
            const snapshotItems = [
              {
                id: 1792840000001,
                title: '첸이보 / 로드 트립 이타백 / 인형 캔뱃지 콘서트 아이돌 직관 굿즈',
                price: 28900,
                category: '패션/잡화',
                priority: 4,
                status: 'pending',
                memo: '에스엠라지 / 오프화이트',
                link: '',
                createdAt: '2026-10-24'
              },
              {
                id: 1792840000002,
                title: '삼성 갤럭시 워치9 강화유리 패키지 크림, 40mm, 블루투스',
                price: 426600,
                category: '전자기기',
                priority: 4,
                status: 'pending',
                memo: '네이버쇼핑(쇼마젠시), 최대할인가 적용(정가 499,000원), 무료배송',
                link: '',
                createdAt: '2026-10-24'
              }
            ];
            for (const snap of snapshotItems) {
              const exists = cleanWishlist.some(w => w.title && w.title.includes(snap.title.slice(0, 8)));
              if (!exists) {
                cleanWishlist.push(snap);
                recovered = true;
              }
            }
          }

          setWishlist(cleanWishlist);
          localStorage.setItem('budget_wishlist', JSON.stringify(cleanWishlist));
          wishCount = cleanWishlist.length;

          // If recovered OR if old __SYS_CONFIG__ row was present in the wishlist sheet, clean up the wishlist sheet immediately
          if (recovered || sysRow) {
            await postToGoogleSheets(sheetsUrl, {
              action: 'sync_wishlist',
              wishlist: cleanWishlist
            });
          }
        }

        // 3. Monthly Budget Target + Gemini API Key Sync (stored in '설정' sheet)
        const sheetBudget = Number(data.settings?.monthly_budget) || Number(embeddedConfig?.monthly_budget) || 0;
        let finalBudget = 1200000;

        const sheetApiKey = (data.settings?.gemini_api_key || embeddedConfig?.gemini_api_key || '').trim();
        const localApiKey = (localStorage.getItem('budget_gemini_key') || '').trim();
        const finalApiKey = (sheetApiKey && !sheetApiKey.includes('...')) ? sheetApiKey : localApiKey;
        if (finalApiKey) {
          localStorage.setItem('budget_gemini_key', finalApiKey);
        }

        if (overrideLocalBudget && Number(overrideLocalBudget) !== 1200000) {
          finalBudget = Number(overrideLocalBudget);
          await postToGoogleSheets(sheetsUrl, {
            action: 'update_budget',
            monthly_budget: finalBudget,
            gemini_api_key: finalApiKey
          });
        } else if (sheetBudget && sheetBudget !== 1200000) {
          finalBudget = sheetBudget;
        } else if (localBudget && localBudget !== 1200000 && (!sheetBudget || sheetBudget === 1200000)) {
          finalBudget = localBudget;
          await postToGoogleSheets(sheetsUrl, {
            action: 'update_budget',
            monthly_budget: finalBudget,
            gemini_api_key: finalApiKey
          });
        } else if (sheetBudget) {
          finalBudget = sheetBudget;
        } else if (localBudget) {
          finalBudget = localBudget;
        }

        if (localApiKey && !data.settings?.gemini_api_key) {
          // Save API key into '설정' sheet
          await postToGoogleSheets(sheetsUrl, {
            action: 'update_budget',
            monthly_budget: finalBudget,
            gemini_api_key: finalApiKey
          });
        }

        localStorage.setItem('budget_monthly_target', String(finalBudget));
        setSettings(prev => ({
          ...prev,
          gemini_api_key: finalApiKey || prev?.gemini_api_key || '',
          hasApiKey: !!(finalApiKey || prev?.hasApiKey),
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
        showToast(`🎉 DB 동기화 완료! (내역 ${txCount}건, 위시리스트 ${wishCount}건)`);
      }
    } catch (err) {
      if (!silent) {
        showToast('⚠️ DB 동기화 실패: URL을 확인해 주세요.');
      }
    } finally {
      setIsSyncing(false);
    }
  }, [month, year, settings?.google_sheets_url, fetchStats]);

  // Initial load + Auto-sync from Google Sheets on startup & tab focus
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sheetFromUrl = urlParams.get('sheet');
    const keyFromUrl = urlParams.get('key');
    if (keyFromUrl) {
      localStorage.setItem('budget_gemini_key', keyFromUrl.trim());
      setSettings(prev => ({ ...prev, gemini_api_key: keyFromUrl.trim(), hasApiKey: true }));
    }
    if (sheetFromUrl && !sheetFromUrl.includes('/macros/library/')) {
      localStorage.setItem('budget_sheets_url', sheetFromUrl.trim());
      setSettings(prev => ({ ...prev, google_sheets_url: sheetFromUrl.trim() }));
      window.history.replaceState({}, document.title, window.location.pathname);
      showToast('🔗 구글 시트 및 AI 키가 자동 연결되었습니다!');
    } else if (keyFromUrl) {
      window.history.replaceState({}, document.title, window.location.pathname);
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

  // Global Clipboard Paste (Ctrl+V) listener — routes to Wishlist AI Scanner if on Wishlist view
  useEffect(() => {
    const handlePaste = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            e.preventDefault();
            const isWishlistMode = isWishlistScannerOpen || (!isScannerOpen && currentView === 'wishlist');
            if (isWishlistMode) {
              setInitialFileForWishlistScanner(blob);
              setIsWishlistScannerOpen(true);
              showToast('🛍️ 클립보드 상품 캡처를 감지하여 위시리스트 AI 분석을 시작합니다!');
            } else {
              setInitialFileForScanner(blob);
              setIsScannerOpen(true);
              showToast('📋 클립보드 영수증 캡처를 감지하여 가계부 AI 분석을 시작합니다!');
            }
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [currentView, isWishlistScannerOpen, isScannerOpen]);

  // Global Drag & Drop listener — routes to Wishlist AI Scanner if on Wishlist view
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
          const isWishlistMode = isWishlistScannerOpen || (!isScannerOpen && currentView === 'wishlist');
          if (isWishlistMode) {
            setInitialFileForWishlistScanner(file);
            setIsWishlistScannerOpen(true);
            showToast('🛍️ 드롭된 상품 이미지를 감지하여 위시리스트 AI 분석을 시작합니다!');
          } else {
            setInitialFileForScanner(file);
            setIsScannerOpen(true);
            showToast('📸 드롭된 영수증 이미지를 감지하여 가계부 AI 분석을 시작합니다!');
          }
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
  }, [currentView, isWishlistScannerOpen, isScannerOpen]);

  // Save Transaction (from Scanner or Manual modal)
  const handleSaveTransaction = (rawData) => {
    const saving = isSavingTx(rawData);
    const necessity = saving ? undefined : (rawData.necessity || (rawData.type === 'expense' ? getNecessity(rawData) : 'need'));
    const cleanAmt = cleanNumber(rawData.amount);
    const cleanDate = normalizeDateYMD(rawData.date);
    const cleanTime = normalizeTimeHM(rawData.time) || new Date().toTimeString().slice(0, 5);

    const data = {
      ...rawData,
      type: saving ? 'saving' : (rawData.type || 'expense'),
      category: saving ? '저축/투자' : (rawData.category || '기타'),
      necessity,
      amount: cleanAmt,
      date: cleanDate,
      time: cleanTime
    };
    const isUpdate = !!data.id;
    const txWithId = isUpdate ? data : { ...data, id: Date.now() };

    // 1. Update LocalStorage & state immediately (instant UI feedback)
    let list = [];
    try {
      const saved = localStorage.getItem('budget_local_transactions');
      list = saved ? JSON.parse(saved) : [];
    } catch (_) {}

    if (isUpdate) {
      list = list.map(item => item.id === data.id ? { ...item, ...data } : item);
    } else {
      list.unshift(txWithId);
    }
    localStorage.setItem('budget_local_transactions', JSON.stringify(list));

    const txYear = parseInt(cleanDate.slice(0, 4), 10);
    const txMonth = parseInt(cleanDate.slice(5, 7), 10);
    if (!isNaN(txYear) && !isNaN(txMonth) && (txYear !== year || txMonth !== month)) {
      setCurrentDate(new Date(txYear, txMonth - 1, 1));
    } else {
      const monthStr = String(month).padStart(2, '0');
      const pattern = `${year}-${monthStr}`;
      setTransactions(list.filter(t => normalizeDateYMD(t.date).startsWith(pattern)));
    }

    fetchStats();
    showToast(isUpdate ? '✅ 내역이 수정되었습니다!' : '🎉 가계부에 성공적으로 등록되었습니다!');

    // 2. Background sync (never blocks UI)
    try {
      const url = isUpdate ? `/api/transactions/${data.id}` : '/api/transactions';
      const method = isUpdate ? 'PUT' : 'POST';
      fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).catch(() => {});
    } catch (_) {}

    const sheetsUrl = (settings?.google_sheets_url || localStorage.getItem('budget_sheets_url') || '').trim();
    if (sheetsUrl) {
      if (isUpdate) {
        postToGoogleSheets(sheetsUrl, { action: 'sync_transactions', transactions: list });
      } else {
        postToGoogleSheets(sheetsUrl, { action: 'add_transaction', ...txWithId });
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
    setTransactions(list.filter(t => normalizeDateYMD(t.date).startsWith(pattern)));
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

    // Push budget + Gemini API key to Google Sheets '설정' sheet
    if (cleanSheetsUrl && !cleanSheetsUrl.includes('/macros/library/')) {
      const currentKey = (newSettings.gemini_api_key || localStorage.getItem('budget_gemini_key') || '').trim();
      await postToGoogleSheets(cleanSheetsUrl, {
        action: 'update_budget',
        monthly_budget: newBudget,
        gemini_api_key: currentKey
      });
    }

    showToast('⚙️ 설정이 안전하게 저장 및 동기화되었습니다.');
  };

  // Sync Wishlist to Google Sheets ('위시리스트' sheet only)
  const handleSyncWishlist = async (wishlistItems) => {
    const cleanItems = (wishlistItems || []).filter(
      w => w && w.id !== '__SYS_CONFIG__' && w.title !== '__SYS_CONFIG__'
    );
    setWishlist(cleanItems);
    localStorage.setItem('budget_wishlist', JSON.stringify(cleanItems));
    const sheetsUrl = (settings?.google_sheets_url || localStorage.getItem('budget_sheets_url') || '').trim();
    if (sheetsUrl) {
      await postToGoogleSheets(sheetsUrl, {
        action: 'sync_wishlist',
        wishlist: cleanItems
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
        {/* Mobile PWA App Install Banner (Hidden on PC or once installed as standalone app) */}
        {!isStandalone && !hideInstallBanner && (
          <div className="md:hidden bg-zinc-900 text-white rounded-2xl p-3 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0 border border-zinc-700">
                <Smartphone className="w-4 h-4 text-zinc-200" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">홈 화면에 가계부 앱 설치</div>
                <div className="text-[10px] text-zinc-400 truncate">크롬 주소창 없이 진짜 앱처럼 1초 만에 실행</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={handleInstallPwa}
                className="px-3 py-1.5 bg-white hover:bg-zinc-100 text-zinc-900 font-bold text-xs rounded-xl transition active:scale-95 whitespace-nowrap flex-shrink-0"
              >
                앱 설치
              </button>
              <button
                onClick={() => {
                  setHideInstallBanner(true);
                  sessionStorage.setItem('budget_hide_pwa_banner', '1');
                }}
                className="p-1 text-zinc-400 hover:text-white rounded-lg transition flex-shrink-0"
                aria-label="배너 닫기"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* View Switcher Tabs + Mobile Quick Add */}
        <div className="flex items-center justify-between gap-2 pb-1">
          <div className="flex bg-zinc-200/60 p-0.5 rounded-xl text-xs font-semibold flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                setCurrentView('budget');
                setActiveMobileTab('overview');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition active:scale-95 whitespace-nowrap ${
                currentView === 'budget'
                  ? 'bg-white text-zinc-900 shadow-xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <Wallet className="w-3.5 h-3.5 flex-shrink-0" />
              <span>가계부</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentView('wishlist');
                setActiveMobileTab('wishlist');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition active:scale-95 whitespace-nowrap ${
                currentView === 'wishlist'
                  ? 'bg-white text-zinc-900 shadow-xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 flex-shrink-0 ${currentView === 'wishlist' ? 'fill-zinc-800' : ''}`} />
              <span>위시리스트</span>
            </button>
          </div>

          {currentView === 'budget' && (
            <div className="flex md:hidden items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setInitialFileForScanner(null);
                  setIsScannerOpen(true);
                }}
                className="cursor-pointer flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-zinc-900 rounded-xl whitespace-nowrap flex-shrink-0 active:scale-95 transition"
              >
                <Sparkles className="w-3 h-3 flex-shrink-0" />
                <span>AI 인식</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingTx(null);
                  setIsTxModalOpen(true);
                }}
                className="cursor-pointer flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 rounded-xl whitespace-nowrap flex-shrink-0 active:scale-95 transition"
              >
                <span>+ 직접 입력</span>
              </button>
            </div>
          )}
        </div>

        {currentView === 'wishlist' ? (
          <Wishlist
            items={wishlist}
            onUpdateItems={setWishlist}
            remainingBudget={stats?.remainingBudget || 0}
            onConvertToExpense={handleSaveTransaction}
            onSyncWishlist={handleSyncWishlist}
            onOpenWishlistScanner={() => {
              setInitialFileForWishlistScanner(null);
              setIsWishlistScannerOpen(true);
            }}
            hasGoogleSheets={!!(settings?.google_sheets_url || localStorage.getItem('budget_sheets_url'))}
            onPullFromGoogleSheets={() => handleSyncGoogleSheets()}
            isSyncing={isSyncing}
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

      <WishlistAiScannerModal
        isOpen={isWishlistScannerOpen}
        onClose={() => {
          setIsWishlistScannerOpen(false);
          setInitialFileForWishlistScanner(null);
        }}
        onAddWishlistItem={(newItem) => {
          let currentList = wishlist;
          try {
            const saved = localStorage.getItem('budget_wishlist');
            if (saved) {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed) && parsed.length >= currentList.length) {
                currentList = parsed;
              }
            }
          } catch (_) {}
          const updated = [newItem, ...currentList];
          handleSyncWishlist(updated);
          showToast('🛍️ AI가 인식한 상품이 위시리스트에 등록되었습니다!');
        }}
        remainingBudget={stats?.remainingBudget || 0}
        hasApiKey={settings?.hasApiKey}
        onSaveApiKey={(key) => handleSaveSettings({ gemini_api_key: key })}
        initialFile={initialFileForWishlistScanner}
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

      {/* Mobile PWA Install Guide Modal (Fallback for iOS or when Chrome menu install is needed) */}
      {isInstallGuideOpen && (
        <div
          onClick={() => setIsInstallGuideOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-xs animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-zinc-200 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-zinc-900" />
                <h3 className="text-sm font-bold text-zinc-900">폰 홈 화면에 앱 설치하기</h3>
              </div>
              <button
                onClick={() => setIsInstallGuideOpen(false)}
                className="p-1.5 -mr-1 text-zinc-400 hover:text-zinc-900 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-700 leading-relaxed">
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-1">
                <div className="font-bold text-zinc-900">🤖 갤럭시 / 안드로이드 (크롬)</div>
                <p className="text-zinc-600 break-keep">
                  크롬 우측 상단 <strong>점 3개(⋮) 메뉴</strong>를 누른 뒤 <strong>[앱 설치]</strong> 또는 <strong>[홈 화면에 추가]</strong>를 누르면 바탕화면에 진짜 앱 아이콘이 생성됩니다!
                </p>
              </div>

              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-1">
                <div className="font-bold text-zinc-900">🍎 아이폰 (Safari / 크롬)</div>
                <p className="text-zinc-600 break-keep">
                  화면 하단(또는 주소창 옆) <strong>공유 버튼 [↑]</strong>을 누른 뒤 아래로 내려 <strong>[홈 화면에 추가]</strong>를 누르면 앱처럼 바로 실행됩니다!
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsInstallGuideOpen(false)}
              className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-xl transition"
            >
              확인했어요
            </button>
          </div>
        </div>
      )}

      {/* Mobile Fixed Bottom Navigation */}
      <MobileBottomNav
        activeTab={currentView === 'wishlist' ? 'wishlist' : activeMobileTab}
        setActiveTab={(tab) => {
          if (tab === 'wishlist') {
            setCurrentView('wishlist');
            setActiveMobileTab('wishlist');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            setCurrentView('budget');
            setActiveMobileTab(tab);
            if (tab === 'overview') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else if (tab === 'transactions') {
              setTimeout(() => {
                const el = document.getElementById('transaction-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }, 50);
            }
          }
        }}
        onOpenScanner={() => {
          if (currentView === 'wishlist') {
            setInitialFileForWishlistScanner(null);
            setIsWishlistScannerOpen(true);
          } else {
            setInitialFileForScanner(null);
            setIsScannerOpen(true);
          }
        }}
        onOpenQrModal={() => setIsQrModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
      />
    </div>
  );
}
