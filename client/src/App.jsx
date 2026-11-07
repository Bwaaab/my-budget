import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import {
  normalizeDateYMD,
  normalizeTimeHM,
  isSavingTx,
  isPointTx,
  isPointEarnTx,
  getNecessity,
  cleanNumber,
  todayYMD,
  nowHM,
  getBudgetMonthRange,
  getActiveBudgetMonth,
  getDeletedTxIds,
  addDeletedTxIds,
  getRecoveredLocalTransactions,
  saveSafeAutoBackupSnapshot,
  sortTransactionsLatestFirst,
  getPendingSheetQueries,
  enqueueSheetQuery,
  removePendingSheetQuery,
  getLocalPointTransactions,
  setLocalPointTransactions
} from './constants';
import { getSheetsToken, setSheetsToken, ensureSheetsToken, buildSheetsGetUrl } from './sheetsAuth';

// Helper: Client-side stats computation (used on GitHub Pages / Serverless)
function computeClientStats(txList, year, month, monthlyBudget = 1200000, startDay = 1) {
  const range = getBudgetMonthRange(year, month, startDay);
  const allTx = txList || [];
  const monthlyTx = allTx.filter(t => {
    const d = normalizeDateYMD(t.date);
    return d >= range.startDate && d <= range.endDate;
  });

  let totalExpense = 0;
  let totalNeedExpense = 0;
  let totalWantExpense = 0;
  let totalIncome = 0;
  let totalSaving = 0;
  let allTimeSaving = 0;
  let allTimeIncome = 0;
  let allTimeExpense = 0;
  let totalPointBalance = 0;
  let monthlyPointEarned = 0;
  let monthlyPointUsed = 0;

  for (const t of allTx) {
    const amt = Number(t.amount) || 0;
    if (isPointTx(t)) {
      if (isPointEarnTx(t)) totalPointBalance += amt;
      else totalPointBalance -= amt;
    } else if (isSavingTx(t)) {
      allTimeSaving += amt;
    } else if (t.type === 'income') {
      allTimeIncome += amt;
    } else if (t.type === 'expense') {
      allTimeExpense += amt;
    }
  }

  // Include any unmigrated legacy point transactions if present
  const legacyPoints = getLocalPointTransactions();
  for (const p of (legacyPoints || [])) {
    const amt = cleanNumber(p.amount);
    if (p.type === 'earn') totalPointBalance += amt;
    else if (p.type === 'use') totalPointBalance -= amt;
  }

  const catMap = {};
  const dailyMap = {};
  for (const d of range.days) {
    dailyMap[d.dayKey] = { day: d.day, label: d.label, expense: 0, income: 0, saving: 0 };
  }

  for (const t of monthlyTx) {
    const amt = Number(t.amount) || 0;
    const cleanDate = normalizeDateYMD(t.date);
    if (isPointTx(t)) {
      if (isPointEarnTx(t)) monthlyPointEarned += amt;
      else monthlyPointUsed += amt;
    } else if (isSavingTx(t)) {
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

  // Cumulative cash left to spend right now across all months = AllTimeIncome - AllTimeExpense - AllTimeSaving
  const cashBalance = allTimeIncome - allTimeExpense - allTimeSaving;
  // Available Balance including cash + point balance
  const balance = cashBalance + totalPointBalance;

  const monthlyBalance = totalIncome - totalExpense - totalSaving;
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
    startDate: range.startDate,
    endDate: range.endDate,
    rangeLabel: range.rangeLabel,
    totalExpense,
    totalNeedExpense,
    totalWantExpense,
    needPercent,
    wantPercent,
    totalIncome,
    totalSaving,
    allTimeSaving,
    cashBalance,
    totalPointBalance,
    monthlyPointEarned,
    monthlyPointUsed,
    balance,
    monthlyBalance,
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
  if (!sheetsUrl || sheetsUrl.includes('/macros/library/')) return false;
  writeRevision++;
  lastWriteTimestamp = Date.now();

  // Attach security token for Apps Script verification
  const token = getSheetsToken();
  const securePayload = { ...payload, token };
  const body = JSON.stringify(securePayload);

  let ok = false;
  const task = activeWritePromise.then(async () => {
    try {
      const res = await fetch(sheetsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body
      });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json && json.error === 'unauthorized') {
          ok = false;
        } else {
          ok = true;
        }
      }
    } catch (_) {
      try {
        await fetch(sheetsUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body
        });
        ok = true;
      } catch (__) {}
    } finally {
      lastWriteTimestamp = Date.now();
    }
    return ok;
  });

  activeWritePromise = task.catch(() => false);
  return task;
}

// Helper: Ensure wishlist payload only contains clean wishlist items (no system config rows)
function buildSyncedWishlistPayload(wishlistItems) {
  return (wishlistItems || []).filter(
    w => w && w.id !== '__SYS_CONFIG__' && w.title !== '__SYS_CONFIG__'
  );
}

export default function App() {
  const [monthStartDay, setMonthStartDay] = useState(() => {
    return Number(localStorage.getItem('budget_month_start_day')) || 1;
  });

  const [currentDate, setCurrentDate] = useState(() => {
    const startDay = Number(localStorage.getItem('budget_month_start_day')) || 1;
    return getActiveBudgetMonth(new Date(), startDay);
  });

  // Initialize directly from localStorage (with automatic recovery from backup snapshot) filtered by active budget month
  const [transactions, setTransactions] = useState(() => {
    try {
      const list = getRecoveredLocalTransactions();
      const startDay = Number(localStorage.getItem('budget_month_start_day')) || 1;
      const activeDate = getActiveBudgetMonth(new Date(), startDay);
      const range = getBudgetMonthRange(activeDate.getFullYear(), activeDate.getMonth() + 1, startDay);
      return list.filter(t => {
        const d = normalizeDateYMD(t.date);
        return d >= range.startDate && d <= range.endDate;
      });
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
    const startDay = Number(localStorage.getItem('budget_month_start_day')) || 1;
    return {
      gemini_api_key: key,
      hasApiKey: !!key,
      monthly_budget: b,
      google_sheets_url: sheets,
      month_start_day: startDay
    };
  });

  const [stats, setStats] = useState(() => {
    const b = Number(localStorage.getItem('budget_monthly_target')) || 1200000;
    const startDay = Number(localStorage.getItem('budget_month_start_day')) || 1;
    const activeDate = getActiveBudgetMonth(new Date(), startDay);
    const list = getRecoveredLocalTransactions();
    return computeClientStats(list, activeDate.getFullYear(), activeDate.getMonth() + 1, b, startDay);
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

  // Always track latest active period in a ref so async syncs never overwrite UI with a stale month closure
  const latestPeriodRef = useRef({ year, month, monthStartDay });
  latestPeriodRef.current = { year, month, monthStartDay };

  // Keep stats in sync whenever transactions, year, month, monthly_budget, or monthStartDay change
  useEffect(() => {
    const b = Number(settings?.monthly_budget) || Number(localStorage.getItem('budget_monthly_target')) || 1200000;
    const startDay = Number(monthStartDay) || Number(settings?.month_start_day) || Number(localStorage.getItem('budget_month_start_day')) || 1;
    let allTx = transactions;
    try {
      const saved = localStorage.getItem('budget_local_transactions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= allTx.length) allTx = parsed;
      }
    } catch (_) {}
    setStats(computeClientStats(allTx, year, month, b, startDay));
  }, [transactions, year, month, settings?.monthly_budget, settings?.month_start_day, monthStartDay]);

  // 1. Fetch Transactions (Merges localStorage + auto-recovery snapshot & optional local server)
  const fetchTransactions = useCallback(async () => {
    const { year: curY, month: curM, monthStartDay: curStart } = latestPeriodRef.current;
    const hasSheets = !!(localStorage.getItem('budget_sheets_url'));
    const localList = getRecoveredLocalTransactions();

    if (!hasSheets) {
      try {
        const res = await fetch(`/api/transactions?year=${curY}&month=${curM}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0 && localList.length === 0) {
            setTransactions(data);
            localStorage.setItem('budget_local_transactions', JSON.stringify(data));
            saveSafeAutoBackupSnapshot(data);
            return;
          }
        }
      } catch (_) {}
    }

    const range = getBudgetMonthRange(curY, curM, curStart);
    const filtered = localList.filter(t => {
      const d = normalizeDateYMD(t.date);
      return d >= range.startDate && d <= range.endDate;
    });
    setTransactions(filtered);
  }, [year, month, monthStartDay]);

  // 2. Fetch Stats
  const fetchStats = useCallback(async () => {
    const { year: curY, month: curM, monthStartDay: curStart } = latestPeriodRef.current;
    const localList = getRecoveredLocalTransactions();
    const b = Number(localStorage.getItem('budget_monthly_target')) || Number(settings?.monthly_budget) || 1200000;
    const startDay = Number(curStart) || Number(settings?.month_start_day) || 1;
    setStats(computeClientStats(localList, curY, curM, b, startDay));
  }, [year, month, settings?.monthly_budget, settings?.month_start_day, monthStartDay]);

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

  // 5. Migrate any legacy separate point transactions into unified transactions + Google Sheets queue
  const fetchPoints = useCallback(async () => {
    const legacy = getLocalPointTransactions();
    if (!Array.isArray(legacy) || legacy.length === 0) return;

    let list = getRecoveredLocalTransactions();
    const existingIds = new Set(list.map(t => String(t.id)));
    let migratedAny = false;

    for (const p of legacy) {
      const txId = p.id || Date.now() + Math.floor(Math.random() * 1000);
      if (!existingIds.has(String(txId))) {
        const isUse = p.type === 'use';
        const migratedTx = {
          id: txId,
          type: isUse ? 'expense' : 'income',
          category: '포인트',
          payment_method: '네이버페이(포인트)',
          necessity: isUse ? 'need' : undefined,
          amount: cleanNumber(p.amount),
          merchant: p.title || (isUse ? '포인트 사용' : '포인트 적립'),
          date: normalizeDateYMD(p.date),
          time: normalizeTimeHM(p.time) || nowHM(),
          memo: p.memo || '',
          updatedAt: Date.now(),
          synced: false
        };
        list.push(migratedTx);
        enqueueSheetQuery({ action: 'add_transaction', id: migratedTx.id, payload: migratedTx });
        migratedAny = true;
      }
    }

    setLocalPointTransactions([]);
    if (migratedAny) {
      list = sortTransactionsLatestFirst(list);
      localStorage.setItem('budget_local_transactions', JSON.stringify(list));
      saveSafeAutoBackupSnapshot(list);
      fetchTransactions();
      fetchStats();
    }
  }, [fetchTransactions, fetchStats]);

  // Google Sheets Full Sync (Smart Merge: Preserves unsynced local records + syncs Wishlist & Settings)
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
      // Wait for any in-flight POST to finish on Google Sheets first
      await activeWritePromise;

      // 0. Flush any pending timestamped queries in strict chronological order (oldest -> newest)
      const pendingQueries = getPendingSheetQueries();
      if (pendingQueries.length > 0) {
        for (const q of pendingQueries) {
          const ok = await postToGoogleSheets(sheetsUrl, {
            action: q.action,
            id: q.id,
            ...q.payload,
            updatedAt: q.timestamp
          });
          if (ok) {
            removePendingSheetQuery(q.queryId);
          }
        }
      }

      const startRevision = writeRevision;

      const authenticatedGetUrl = buildSheetsGetUrl(sheetsUrl);
      const res = await fetch(authenticatedGetUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data && data.error === 'unauthorized') {
        showToast('🔒 구글 시트 보안 인증 실패: 토큰이 일치하지 않습니다. 설정에서 확인해 주세요.');
        return;
      }

      // If user performed a write/add/delete while GET was in flight, discard stale GET response
      if (writeRevision !== startRevision) {
        return;
      }

      let txCount = 0;
      let wishCount = 0;
      const localBudget = Number(overrideLocalBudget) || Number(localStorage.getItem('budget_monthly_target')) || 0;

      if (data && typeof data === 'object' && !Array.isArray(data)) {
        // 1. Check embedded config & month_start_day first so period range is up-to-date before filtering
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

          setWishlist(cleanWishlist);
          localStorage.setItem('budget_wishlist', JSON.stringify(cleanWishlist));
          wishCount = cleanWishlist.length;

          if (sysRow) {
            await postToGoogleSheets(sheetsUrl, {
              action: 'sync_wishlist',
              wishlist: cleanWishlist
            });
          }
        }

        const sheetStartDay = Number(data.settings?.month_start_day) || Number(embeddedConfig?.month_start_day) || 0;
        let finalStartDay = latestPeriodRef.current.monthStartDay;
        if (sheetStartDay >= 1 && sheetStartDay <= 31) {
          finalStartDay = sheetStartDay;
          localStorage.setItem('budget_month_start_day', String(sheetStartDay));
          if (sheetStartDay !== latestPeriodRef.current.monthStartDay) {
            setMonthStartDay(sheetStartDay);
            const activeDate = getActiveBudgetMonth(new Date(), sheetStartDay);
            setCurrentDate(activeDate);
            latestPeriodRef.current = {
              year: activeDate.getFullYear(),
              month: activeDate.getMonth() + 1,
              monthStartDay: sheetStartDay
            };
          }
        }

        // 2. Transactions — Pure Sheet Viewer (Google Sheets = 100% Single Source of Truth, sorted latest-first)
        if (Array.isArray(data.transactions)) {
          const sheetTx = sortTransactionsLatestFirst(
            data.transactions.map(t => {
              const saving = isSavingTx(t);
              return {
                ...t,
                type: saving ? 'saving' : (t.type || 'expense'),
                category: saving ? '저축/투자' : (t.category || '기타'),
                necessity: saving ? undefined : (t.necessity || getNecessity(t)),
                date: normalizeDateYMD(t.date),
                time: normalizeTimeHM(t.time),
                synced: true
              };
            })
          );

          localStorage.removeItem('budget_deleted_tx_ids');
          localStorage.setItem('budget_local_transactions', JSON.stringify(sheetTx));
          saveSafeAutoBackupSnapshot(sheetTx);

          const { year: curY, month: curM, monthStartDay: curStart } = latestPeriodRef.current;
          const range = getBudgetMonthRange(curY, curM, curStart);
          setTransactions(sheetTx.filter(t => {
            const d = normalizeDateYMD(t.date);
            return d >= range.startDate && d <= range.endDate;
          }));
          txCount = sheetTx.length;
        }

        // 3. Monthly Budget Target & Gemini API Key Sync (stored in '설정' sheet)
        const sheetBudget = Number(data.settings?.monthly_budget) || Number(embeddedConfig?.monthly_budget) || 0;
        let finalBudget = 1200000;

        const sheetApiKey = (data.settings?.gemini_api_key || embeddedConfig?.gemini_api_key || '').trim();
        const localApiKey = (localStorage.getItem('budget_gemini_key') || '').trim();
        // Local device key takes priority so shared sheets never overwrite or wipe out user's newly entered key!
        const finalApiKey = localApiKey || (sheetApiKey && !sheetApiKey.includes('...') ? sheetApiKey : '');
        if (finalApiKey) {
          localStorage.setItem('budget_gemini_key', finalApiKey);
        }

        // If local device has an API key that differs from sheet, push it to sheet
        if (localApiKey && localApiKey !== sheetApiKey && (!sheetApiKey || !sheetApiKey.includes('...'))) {
          postToGoogleSheets(sheetsUrl, {
            action: 'update_budget',
            monthly_budget: finalBudget,
            gemini_api_key: localApiKey,
            month_start_day: finalStartDay
          });
        }

        if (overrideLocalBudget && Number(overrideLocalBudget) !== 1200000) {
          finalBudget = Number(overrideLocalBudget);
          await postToGoogleSheets(sheetsUrl, {
            action: 'update_budget',
            monthly_budget: finalBudget,
            gemini_api_key: finalApiKey,
            month_start_day: finalStartDay
          });
        } else if (sheetBudget && sheetBudget !== 1200000) {
          finalBudget = sheetBudget;
        } else if (localBudget && localBudget !== 1200000 && (!sheetBudget || sheetBudget === 1200000)) {
          finalBudget = localBudget;
          await postToGoogleSheets(sheetsUrl, {
            action: 'update_budget',
            monthly_budget: finalBudget,
            gemini_api_key: finalApiKey,
            month_start_day: finalStartDay
          });
        } else if (sheetBudget) {
          finalBudget = sheetBudget;
        } else if (localBudget) {
          finalBudget = localBudget;
        }

        if (localApiKey && !data.settings?.gemini_api_key) {
          await postToGoogleSheets(sheetsUrl, {
            action: 'update_budget',
            monthly_budget: finalBudget,
            gemini_api_key: finalApiKey,
            month_start_day: finalStartDay
          });
        }

        localStorage.setItem('budget_monthly_target', String(finalBudget));
        setSettings(prev => ({
          ...prev,
          gemini_api_key: finalApiKey || prev?.gemini_api_key || '',
          hasApiKey: !!(finalApiKey || prev?.hasApiKey),
          monthly_budget: finalBudget,
          google_sheets_url: sheetsUrl,
          month_start_day: finalStartDay
        }));
      } else if (Array.isArray(data)) {
        localStorage.setItem('budget_local_transactions', JSON.stringify(data));
        const { year: curY, month: curM, monthStartDay: curStart } = latestPeriodRef.current;
        const range = getBudgetMonthRange(curY, curM, curStart);
        setTransactions(data.filter(t => {
          const d = normalizeDateYMD(t.date);
          return d >= range.startDate && d <= range.endDate;
        }));
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
  }, [month, year, monthStartDay, settings?.google_sheets_url, fetchStats]);

  const syncFnRef = useRef(handleSyncGoogleSheets);
  syncFnRef.current = handleSyncGoogleSheets;

  // Initial load + Auto-sync from Google Sheets on startup & tab focus
  useEffect(() => {
    // 1. Parse Hash parameters first (#sheet=...&token=...) for maximum security
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const hashParams = new URLSearchParams(hash);
    const sheetFromHash = hashParams.get('sheet');
    const tokenFromHash = hashParams.get('token');

    // 2. Fallback to query params for legacy ?sheet=
    const urlParams = new URLSearchParams(window.location.search);
    const sheetFromQuery = urlParams.get('sheet');

    const incomingSheet = (sheetFromHash || sheetFromQuery || '').trim();
    if (tokenFromHash) {
      setSheetsToken(tokenFromHash.trim());
    }

    if (incomingSheet && !incomingSheet.includes('/macros/library/')) {
      localStorage.setItem('budget_sheets_url', incomingSheet);
      setSettings(prev => ({ ...prev, google_sheets_url: incomingSheet }));
      showToast('🔗 구글 시트가 안전하게 자동 연결되었습니다!');
    }

    // Clean up address bar after a brief delay so mobile browsers / PWA installers don't lose the hash immediately
    if (sheetFromHash || tokenFromHash || sheetFromQuery || urlParams.get('key')) {
      setTimeout(() => {
        try {
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (_) {}
      }, 1500);
    }

    fetchTransactions();
    fetchStats();
    fetchSettings();
    fetchNetworkInfo();
    fetchPoints();

    const activeSheet = (incomingSheet || localStorage.getItem('budget_sheets_url') || '').trim();
    if (activeSheet && !activeSheet.includes('/macros/library/')) {
      syncFnRef.current(activeSheet, null, !incomingSheet);
    }

    // Auto-sync whenever user returns to the app/tab on mobile or PC (Always uses latest syncFnRef)
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        const currentSheet = (localStorage.getItem('budget_sheets_url') || '').trim();
        if (currentSheet && !currentSheet.includes('/macros/library/')) {
          syncFnRef.current(currentSheet, null, true);
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

  // Re-filter transactions when month/year/monthStartDay changes
  useEffect(() => {
    fetchTransactions();
    fetchStats();
  }, [year, month, monthStartDay, fetchTransactions, fetchStats]);

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
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const imageFiles = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
        if (imageFiles.length > 0) {
          const isWishlistMode = isWishlistScannerOpen || (!isScannerOpen && currentView === 'wishlist');
          if (isWishlistMode) {
            setInitialFileForWishlistScanner(imageFiles[0]);
            setIsWishlistScannerOpen(true);
            showToast('🛍️ 드롭된 상품 이미지를 감지하여 위시리스트 AI 분석을 시작합니다!');
          } else {
            setInitialFileForScanner(imageFiles.length === 1 ? imageFiles[0] : imageFiles);
            setIsScannerOpen(true);
            showToast(
              imageFiles.length > 1
                ? `📸 드롭된 ${imageFiles.length}장의 캡처 이미지를 일괄 분석합니다!`
                : '📸 드롭된 영수증 이미지를 감지하여 가계부 AI 분석을 시작합니다!'
            );
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

  // Save Transaction (from Scanner or Manual modal) — Timestamped Query + Viewer Update
  const handleSaveTransaction = (rawData) => {
    const saving = isSavingTx(rawData);
    const necessity = saving ? undefined : (rawData.necessity || (rawData.type === 'expense' ? getNecessity(rawData) : 'need'));
    const cleanAmt = cleanNumber(rawData.amount);
    const cleanDate = normalizeDateYMD(rawData.date);
    const cleanTime = normalizeTimeHM(rawData.time) || nowHM();
    const nowTs = Date.now();

    const data = {
      ...rawData,
      type: saving ? 'saving' : (rawData.type || 'expense'),
      category: saving ? '저축/투자' : (rawData.category || '기타'),
      necessity,
      amount: cleanAmt,
      date: cleanDate,
      time: cleanTime,
      updatedAt: nowTs,
      synced: false
    };
    const isUpdate = !!data.id;
    const txWithId = isUpdate ? data : { ...data, id: nowTs };

    // 1. Update LocalStorage & state immediately (instant UI feedback, sorted latest-first)
    let list = [];
    try {
      const saved = localStorage.getItem('budget_local_transactions');
      list = saved ? JSON.parse(saved) : [];
    } catch (_) {}

    if (isUpdate) {
      list = list.map(item => String(item.id) === String(data.id) ? { ...item, ...data, synced: false } : item);
    } else {
      list.unshift(txWithId);
    }
    list = sortTransactionsLatestFirst(list);
    localStorage.setItem('budget_local_transactions', JSON.stringify(list));
    saveSafeAutoBackupSnapshot(list);

    const parts = cleanDate.split('-').map(Number);
    const txYear = parts[0];
    const txMonth = parts[1];
    const txDay = parts[2] || 1;
    const range = getBudgetMonthRange(year, month, monthStartDay);
    if (!isNaN(txYear) && !isNaN(txMonth) && (cleanDate < range.startDate || cleanDate > range.endDate)) {
      const targetDate = getActiveBudgetMonth(new Date(txYear, txMonth - 1, txDay), monthStartDay);
      setCurrentDate(targetDate);
      const tY = targetDate.getFullYear();
      const tM = targetDate.getMonth() + 1;
      latestPeriodRef.current = { year: tY, month: tM, monthStartDay };
      const targetRange = getBudgetMonthRange(tY, tM, monthStartDay);
      setTransactions(list.filter(t => {
        const d = normalizeDateYMD(t.date);
        return d >= targetRange.startDate && d <= targetRange.endDate;
      }));
    } else {
      setTransactions(list.filter(t => {
        const d = normalizeDateYMD(t.date);
        return d >= range.startDate && d <= range.endDate;
      }));
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

    // 3. Enqueue timestamped query & send to Google Sheets Backend
    const action = isUpdate ? 'update_transaction' : 'add_transaction';
    const queryId = enqueueSheetQuery({ action, id: txWithId.id, payload: txWithId });
    const sheetsUrl = (settings?.google_sheets_url || localStorage.getItem('budget_sheets_url') || '').trim();
    if (sheetsUrl) {
      postToGoogleSheets(sheetsUrl, { action, ...txWithId }).then((ok) => {
        if (ok) {
          if (queryId) removePendingSheetQuery(queryId);
          try {
            const cur = JSON.parse(localStorage.getItem('budget_local_transactions') || '[]');
            const updated = cur.map(item => String(item.id) === String(txWithId.id) ? { ...item, synced: true } : item);
            localStorage.setItem('budget_local_transactions', JSON.stringify(updated));
          } catch (_) {}
        }
      });
    }
  };

  // Save Multiple Transactions in a single batch (from Multi-Transaction AI Scanner)
  const handleSaveMultipleTransactions = (rawList) => {
    if (!Array.isArray(rawList) || rawList.length === 0) return;
    if (rawList.length === 1) {
      handleSaveTransaction(rawList[0]);
      return;
    }

    const baseTs = Date.now();
    const preparedList = rawList.map((rawData, idx) => {
      const point = isPointTx(rawData);
      const saving = !point && isSavingTx(rawData);
      const isPointUse = point && (rawData.pointMode === 'use' || rawData.type === 'point_use' || rawData.type === 'expense');
      const finalType = point
        ? isPointUse
          ? 'expense'
          : 'income'
        : saving
        ? 'saving'
        : rawData.type || 'expense';
      const finalCategory = point ? '포인트' : saving ? '저축/투자' : rawData.category || '기타';
      const finalMethod = point
        ? '네이버페이(포인트)'
        : rawData.payment_method || (saving ? '계좌이체' : '신용카드');
      const necessity = point
        ? isPointUse
          ? 'need'
          : undefined
        : saving
        ? undefined
        : rawData.necessity || (finalType === 'expense' ? getNecessity(rawData) : 'need');

      const uniqueTs = baseTs + idx;
      return {
        ...rawData,
        id: uniqueTs,
        type: finalType,
        category: finalCategory,
        payment_method: finalMethod,
        necessity,
        amount: cleanNumber(rawData.amount),
        merchant: (rawData.merchant || '').trim() || '미상',
        date: normalizeDateYMD(rawData.date),
        time: normalizeTimeHM(rawData.time) || nowHM(),
        updatedAt: uniqueTs,
        synced: false
      };
    });

    // 1. Update LocalStorage & state atomically
    let list = [];
    try {
      const saved = localStorage.getItem('budget_local_transactions');
      list = saved ? JSON.parse(saved) : [];
    } catch (_) {}

    list = sortTransactionsLatestFirst([...preparedList, ...list]);
    localStorage.setItem('budget_local_transactions', JSON.stringify(list));
    saveSafeAutoBackupSnapshot(list);

    const firstDate = preparedList[0].date;
    const parts = firstDate.split('-').map(Number);
    const txYear = parts[0];
    const txMonth = parts[1];
    const txDay = parts[2] || 1;
    const range = getBudgetMonthRange(year, month, monthStartDay);

    if (!isNaN(txYear) && !isNaN(txMonth) && (firstDate < range.startDate || firstDate > range.endDate)) {
      const targetDate = getActiveBudgetMonth(new Date(txYear, txMonth - 1, txDay), monthStartDay);
      setCurrentDate(targetDate);
      const tY = targetDate.getFullYear();
      const tM = targetDate.getMonth() + 1;
      latestPeriodRef.current = { year: tY, month: tM, monthStartDay };
      const targetRange = getBudgetMonthRange(tY, tM, monthStartDay);
      setTransactions(
        list.filter((t) => {
          const d = normalizeDateYMD(t.date);
          return d >= targetRange.startDate && d <= targetRange.endDate;
        })
      );
    } else {
      setTransactions(
        list.filter((t) => {
          const d = normalizeDateYMD(t.date);
          return d >= range.startDate && d <= range.endDate;
        })
      );
    }

    fetchStats();
    showToast(`🎉 총 ${preparedList.length}건의 내역이 가계부에 일괄 등록되었습니다!`);

    // 2. Background sync to local server & Google Sheets
    const sheetsUrl = (settings?.google_sheets_url || localStorage.getItem('budget_sheets_url') || '').trim();
    for (const item of preparedList) {
      try {
        fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        }).catch(() => {});
      } catch (_) {}

      const queryId = enqueueSheetQuery({ action: 'add_transaction', id: item.id, payload: item });
      if (sheetsUrl) {
        postToGoogleSheets(sheetsUrl, { action: 'add_transaction', ...item }).then((ok) => {
          if (ok) {
            if (queryId) removePendingSheetQuery(queryId);
            try {
              const cur = JSON.parse(localStorage.getItem('budget_local_transactions') || '[]');
              const updated = cur.map((row) =>
                String(row.id) === String(item.id) ? { ...row, synced: true } : row
              );
              localStorage.setItem('budget_local_transactions', JSON.stringify(updated));
            } catch (_) {}
          }
        });
      }
    }
  };

  // Delete Transaction — Timestamped Delete Query to Google Sheets
  const handleDeleteTransaction = async (id) => {
    if (!confirm('이 내역을 삭제하시겠습니까?')) return;
    try {
      await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    } catch (_) {}

    // Remove from local viewer cache immediately
    let list = [];
    try {
      const saved = localStorage.getItem('budget_local_transactions');
      list = saved ? JSON.parse(saved) : [];
    } catch (_) {}
    list = list.filter(t => String(t.id) !== String(id));
    localStorage.setItem('budget_local_transactions', JSON.stringify(list));
    saveSafeAutoBackupSnapshot(list);

    const range = getBudgetMonthRange(year, month, monthStartDay);
    setTransactions(list.filter(t => {
      const d = normalizeDateYMD(t.date);
      return d >= range.startDate && d <= range.endDate;
    }));
    fetchStats();
    showToast('🗑️ 내역이 삭제되었습니다.');

    const queryId = enqueueSheetQuery({ action: 'delete_transaction', id, payload: { id } });
    const sheetsUrl = (settings?.google_sheets_url || localStorage.getItem('budget_sheets_url') || '').trim();
    if (sheetsUrl) {
      const ok = await postToGoogleSheets(sheetsUrl, { action: 'delete_transaction', id });
      if (ok && queryId) {
        removePendingSheetQuery(queryId);
      }
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

    const prevStartDay = monthStartDay;
    const newStartDay = newSettings.month_start_day !== undefined
      ? Math.max(1, Math.min(31, Number(newSettings.month_start_day) || 1))
      : (Number(localStorage.getItem('budget_month_start_day')) || settings?.month_start_day || 1);

    // Always persist to localstorage first
    if (newSettings.gemini_api_key !== undefined) {
      const cleanKey = newSettings.gemini_api_key.trim();
      if (cleanKey) {
        localStorage.setItem('budget_gemini_key', cleanKey);
      } else {
        localStorage.removeItem('budget_gemini_key');
      }
    }
    if (newSettings.google_sheets_url !== undefined) {
      localStorage.setItem('budget_sheets_url', cleanSheetsUrl);
    }
    if (newBudget > 0) {
      localStorage.setItem('budget_monthly_target', String(newBudget));
    }
    localStorage.setItem('budget_month_start_day', String(newStartDay));
    setMonthStartDay(newStartDay);

    // If startDay changed, automatically jump to the budget month cycle that contains TODAY
    let targetYear = year;
    let targetMonth = month;
    if (newStartDay !== prevStartDay) {
      const activeDate = getActiveBudgetMonth(new Date(), newStartDay);
      setCurrentDate(activeDate);
      targetYear = activeDate.getFullYear();
      targetMonth = activeDate.getMonth() + 1;
    }
    latestPeriodRef.current = {
      year: targetYear,
      month: targetMonth,
      monthStartDay: newStartDay
    };

    // Immediately update local React state
    setSettings(prev => ({
      ...prev,
      gemini_api_key: newSettings.gemini_api_key !== undefined ? newSettings.gemini_api_key : prev?.gemini_api_key,
      hasApiKey: !!(newSettings.gemini_api_key || prev?.hasApiKey || localStorage.getItem('budget_gemini_key')),
      google_sheets_url: cleanSheetsUrl,
      monthly_budget: newBudget,
      month_start_day: newStartDay
    }));

    // Update stats immediately with new budget & start day
    let localList = [];
    try {
      const saved = localStorage.getItem('budget_local_transactions');
      localList = saved ? JSON.parse(saved) : [];
    } catch (_) {}
    setStats(computeClientStats(localList, targetYear, targetMonth, newBudget, newStartDay));

    // Update transactions list for the new date range
    const range = getBudgetMonthRange(targetYear, targetMonth, newStartDay);
    setTransactions(localList.filter(t => {
      const d = normalizeDateYMD(t.date);
      return d >= range.startDate && d <= range.endDate;
    }));

    // Also update local server if running
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newSettings,
          google_sheets_url: cleanSheetsUrl,
          monthly_budget: newBudget,
          month_start_day: newStartDay
        })
      });
    } catch (_) {}

    // Push budget + Gemini API key + month start day to Google Sheets '설정' sheet
    if (cleanSheetsUrl && !cleanSheetsUrl.includes('/macros/library/')) {
      const currentKey = (newSettings.gemini_api_key || localStorage.getItem('budget_gemini_key') || '').trim();
      await postToGoogleSheets(cleanSheetsUrl, {
        action: 'update_budget',
        monthly_budget: newBudget,
        gemini_api_key: currentKey,
        month_start_day: newStartDay
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
        <div className="fixed inset-0 z-50 bg-zinc-900/80 flex flex-col items-center justify-center text-white pointer-events-none border-2 border-dashed border-zinc-400">
          <UploadCloud className="w-12 h-12 text-zinc-300 mb-2" />
          <h2 className="text-base font-bold">영수증/캡처 이미지를 여기에 놓으세요</h2>
          <p className="text-xs text-zinc-400 mt-1">AI가 지출 내역을 자동 분석합니다</p>
        </div>
      )}

      {/* Top Header */}
      <Header
        currentDate={currentDate}
        monthStartDay={monthStartDay}
        rangeLabel={stats.rangeLabel}
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
              onOpenPointAdd={() => {
                setEditingTx({ defaultType: 'point', pointMode: 'earn' });
                setIsTxModalOpen(true);
              }}
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
        onSaveMultipleTransactions={handleSaveMultipleTransactions}
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
        monthStartDay={monthStartDay}
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 animate-fade-in"
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
