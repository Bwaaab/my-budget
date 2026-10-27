import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  Target,
  Download,
  Upload,
  FileSpreadsheet,
  Check,
  ShieldCheck,
  Table,
  Copy,
  RefreshCw,
  ShieldAlert,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { formatKRW } from '../constants';
import {
  getSheetsToken,
  ensureSheetsToken,
  regenerateSheetsToken,
  buildSheetsGetUrl
} from '../sheetsAuth';

export function buildGoogleScriptCode(token) {
  const secret = (token || '').trim();
  return `// ==========================================
// 스마트 AI 가계부 구글 시트 연동 스크립트 (v2 보안 인증 강화)
// ==========================================

var SECRET_TOKEN = '${secret}';

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function unauthorized_() {
  return jsonResponse_({ error: 'unauthorized', message: '보안 토큰이 일치하지 않습니다.' });
}

function checkAuth_(paramToken) {
  if (!SECRET_TOKEN) return true; // 토큰 미설정 시 하위 호환
  return paramToken === SECRET_TOKEN;
}

function doGet(e) {
  var paramToken = (e && e.parameter && e.parameter.token) || '';
  if (!checkAuth_(paramToken)) return unauthorized_();

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Transactions (가계부 내역)
  var txSheet = ss.getSheetByName('가계부') || ss.getActiveSheet();
  var txValues = txSheet.getDataRange().getValues();
  var transactions = [];
  var tz = Session.getScriptTimeZone() || 'Asia/Seoul';

  if (txValues.length > 1) {
    for (var i = 1; i < txValues.length; i++) {
      var row = txValues[i];
      if (!row[1] && !row[4]) continue;

      var dateVal = row[1];
      var dateStr = (dateVal instanceof Date)
        ? Utilities.formatDate(dateVal, tz, "yyyy-MM-dd")
        : String(dateVal || '');

      // 시간 셀이 Date 객체로 변환된 경우 1899년 오프셋 문제 방지
      var timeVal = row[2];
      var timeStr = (timeVal instanceof Date)
        ? Utilities.formatDate(timeVal, tz, "HH:mm")
        : String(timeVal || '');

      transactions.push({
        id: row[0] || i,
        date: dateStr,
        time: timeStr,
        type: row[3] === '수입' ? 'income' : (row[3] === '저축' || row[5] === '저축/투자') ? 'saving' : 'expense',
        amount: Number(row[4]) || 0,
        category: String(row[5] || '기타'),
        merchant: String(row[6] || ''),
        payment_method: String(row[7] || ''),
        memo: String(row[8] || ''),
        necessity: String(row[9] || (row[8] && row[8].includes('[선택]') ? 'want' : (row[8] && row[8].includes('[필수]') ? 'need' : '')))
      });
    }
  }

  // 2. Wishlist (위시리스트)
  var wishSheet = ss.getSheetByName('위시리스트');
  var wishlist = [];
  if (wishSheet) {
    var wishValues = wishSheet.getDataRange().getValues();
    if (wishValues.length > 1) {
      for (var j = 1; j < wishValues.length; j++) {
        var w = wishValues[j];
        if (!w[1]) continue;
        var wDateVal = w[8];
        var wDateStr = (wDateVal instanceof Date)
          ? Utilities.formatDate(wDateVal, tz, "yyyy-MM-dd")
          : String(wDateVal || '');

        wishlist.push({
          id: w[0] || j,
          title: String(w[1] || ''),
          price: Number(w[2]) || 0,
          category: String(w[3] || '쇼핑'),
          priority: Number(w[4]) || 3,
          status: String(w[5] || 'pending'),
          memo: String(w[6] || ''),
          link: String(w[7] || ''),
          createdAt: wDateStr
        });
      }
    }
  }

  // 3. Settings (목표 예산 & Gemini API 키)
  var settingsSheet = ss.getSheetByName('설정');
  var monthly_budget = null;
  var gemini_api_key = '';
  if (settingsSheet) {
    var sVal = settingsSheet.getRange(1, 2).getValue();
    if (sVal) monthly_budget = Number(sVal);
    var kVal = settingsSheet.getRange(2, 2).getValue();
    if (kVal) gemini_api_key = String(kVal);
  }

  return jsonResponse_({
    version: 2,
    transactions: transactions,
    wishlist: wishlist,
    settings: { monthly_budget: monthly_budget, gemini_api_key: gemini_api_key }
  });
}

function doPost(e) {
  var payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ error: 'invalid_json' });
  }

  var paramToken = payload.token || '';
  if (!checkAuth_(paramToken)) return unauthorized_();

  var lock = LockService.getScriptLock();
  lock.waitLock(10000); // 동시성 경합 및 중복 쓰기 방지

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = payload.action || 'add_transaction';

    // 지출/수입 단건 등록 (동일 ID 중복 등록 방지)
    if (action === 'add_transaction') {
      var txSheet = ss.getSheetByName('가계부') || ss.getActiveSheet();
      if (txSheet.getName() !== '가계부') txSheet.setName('가계부');
      if (txSheet.getLastRow() === 0) {
        txSheet.appendRow(['ID', '일자', '시간', '구분', '금액', '카테고리', '상호/사용처', '결제수단', '메모', '필수/선택']);
      }

      var id = payload.id || Date.now();

      // 중복 체크: 이미 해당 ID가 첫 번째 열에 있으면 건너뜀 (네트워크 재전송 방어)
      if (txSheet.getLastRow() > 1) {
        var idColumnRange = txSheet.getRange(2, 1, txSheet.getLastRow() - 1, 1);
        var found = idColumnRange.createTextFinder(String(id)).matchEntireCell(true).findNext();
        if (found) {
          return jsonResponse_({ success: true, id: id, duplicate: true });
        }
      }

      txSheet.appendRow([
        id,
        payload.date || '',
        payload.time || '',
        payload.type === 'income' ? '수입' : (payload.type === 'saving' || payload.category === '저축/투자') ? '저축' : '지출',
        Number(payload.amount) || 0,
        payload.category || '기타',
        payload.merchant || '',
        payload.payment_method || '',
        payload.memo || '',
        payload.type === 'expense' ? (payload.necessity === 'want' ? '선택' : '필수') : ''
      ]);
      return jsonResponse_({ success: true, id: id });
    }

    // 지출/수입 전체 동기화
    if (action === 'sync_transactions') {
      var allTxSheet = ss.getSheetByName('가계부') || ss.getActiveSheet();
      if (allTxSheet.getName() !== '가계부') allTxSheet.setName('가계부');
      allTxSheet.clear();
      allTxSheet.appendRow(['ID', '일자', '시간', '구분', '금액', '카테고리', '상호/사용처', '결제수단', '메모', '필수/선택']);
      if (Array.isArray(payload.transactions)) {
        payload.transactions.forEach(function(t) {
          allTxSheet.appendRow([
            t.id || Date.now(),
            t.date || '',
            t.time || '',
            t.type === 'income' ? '수입' : (t.type === 'saving' || t.category === '저축/투자') ? '저축' : '지출',
            Number(t.amount) || 0,
            t.category || '기타',
            t.merchant || '',
            t.payment_method || '',
            t.memo || '',
            t.type === 'expense' ? (t.necessity === 'want' ? '선택' : '필수') : ''
          ]);
        });
      }
      return jsonResponse_({ success: true });
    }

    // 위시리스트 동기화
    if (action === 'sync_wishlist') {
      var wishSheet = ss.getSheetByName('위시리스트');
      if (!wishSheet) wishSheet = ss.insertSheet('위시리스트');
      wishSheet.clear();
      wishSheet.appendRow(['ID', '상품명', '예상가격', '카테고리', '우선순위', '상태', '메모', '링크', '등록일']);
      if (Array.isArray(payload.wishlist)) {
        payload.wishlist.forEach(function(item) {
          wishSheet.appendRow([
            item.id || Date.now(),
            item.title,
            Number(item.price) || 0,
            item.category || '쇼핑',
            item.priority || 3,
            item.status || 'pending',
            item.memo || '',
            item.link || '',
            item.createdAt || ''
          ]);
        });
      }
      return jsonResponse_({ success: true });
    }

    // 목표 예산 및 AI API 키 저장
    if (action === 'update_budget') {
      var settingsSheet = ss.getSheetByName('설정');
      if (!settingsSheet) settingsSheet = ss.insertSheet('설정');
      settingsSheet.getRange(1, 1).setValue('monthly_budget');
      settingsSheet.getRange(1, 2).setValue(Number(payload.monthly_budget) || 1200000);
      if (payload.gemini_api_key) {
        settingsSheet.getRange(2, 1).setValue('gemini_api_key');
        settingsSheet.getRange(2, 2).setValue(String(payload.gemini_api_key));
      }
      return jsonResponse_({ success: true });
    }

    return jsonResponse_({ success: true });
  } finally {
    lock.releaseLock();
  }
}`;
}

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onRefreshData,
  onSyncGoogleSheets
}) {
  const [apiKey, setApiKey] = useState('');
  const [budget, setBudget] = useState('1200000');
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [token, setToken] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showCodeBox, setShowCodeBox] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState('');
  const [testResult, setTestResult] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  // Cleanup helper states
  const [showCleanup, setShowCleanup] = useState(false);
  const [suspiciousRows, setSuspiciousRows] = useState([]);
  const [selectedCleanupIds, setSelectedCleanupIds] = useState(new Set());
  const [cleanupMessage, setCleanupMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      const savedKey = settings?.gemini_api_key || localStorage.getItem('budget_gemini_key') || '';
      const savedBudget = Number(localStorage.getItem('budget_monthly_target')) || settings?.monthly_budget || 1200000;
      const savedUrl = localStorage.getItem('budget_sheets_url') || settings?.google_sheets_url || '';
      const savedToken = ensureSheetsToken();

      setApiKey(savedKey);
      setBudget(String(savedBudget));
      setGoogleSheetsUrl(savedUrl);
      setToken(savedToken);
      setTestResult('');
      setShowCleanup(false);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const currentScriptCode = buildGoogleScriptCode(token);

  const handleRegenerateToken = () => {
    if (confirm('⚠️ 보안 토큰을 새로 발급하면 기존 QR 코드와 구글 시트 연결이 끊어집니다. 새 스크립트를 시트에 다시 배포해야 합니다. 계속할까요?')) {
      const newToken = regenerateSheetsToken();
      setToken(newToken);
      setTestResult('⚠️ 새 토큰이 발급되었습니다. 아래 스크립트를 복사하여 구글 시트 Apps Script에 다시 배포해 주세요.');
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    const cleanUrl = googleSheetsUrl.trim();
    if (cleanUrl.includes('/macros/library/')) {
      setTestResult('🔴 라이브러리 주소(/library/)입니다! [배포] > [새 배포]에서 끝이 /exec로 끝나는 웹 앱 URL을 복사해 주세요.');
      return;
    }
    await onSaveSettings({
      gemini_api_key: apiKey,
      monthly_budget: Number(budget) || 1200000,
      google_sheets_url: cleanUrl
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleCloseWithSave = () => {
    const cleanUrl = googleSheetsUrl.trim();
    const isValidUrl = !cleanUrl || (!cleanUrl.includes('/macros/library/') && cleanUrl.startsWith('http'));
    const prevKey = (settings?.gemini_api_key || localStorage.getItem('budget_gemini_key') || '').trim();
    const prevBudget = Number(localStorage.getItem('budget_monthly_target')) || settings?.monthly_budget || 1200000;
    const prevUrl = (localStorage.getItem('budget_sheets_url') || settings?.google_sheets_url || '').trim();

    const nextKey = apiKey.trim();
    const nextBudget = Number(budget) || 1200000;
    const nextUrl = isValidUrl ? cleanUrl : prevUrl;

    onClose();

    if (nextKey !== prevKey || nextBudget !== prevBudget || nextUrl !== prevUrl) {
      onSaveSettings({
        gemini_api_key: nextKey,
        monthly_budget: nextBudget,
        google_sheets_url: nextUrl
      });
    }
  };

  const handleTestConnection = async () => {
    const cleanUrl = googleSheetsUrl.trim();
    if (!cleanUrl) {
      setTestResult('구글 시트 URL을 먼저 입력해 주세요.');
      return;
    }
    if (cleanUrl.includes('/macros/library/')) {
      setTestResult('🔴 라이브러리 주소(/library/)입니다. [배포] > [새 배포] > [웹 앱]에서 끝이 /exec로 끝나는 URL을 복사해 주세요.');
      return;
    }

    setIsTesting(true);
    setTestResult('구글 시트와 통신 및 보안 인증 확인 중...');

    try {
      localStorage.setItem('budget_sheets_url', cleanUrl);
      if (apiKey.trim()) {
        localStorage.setItem('budget_gemini_key', apiKey.trim());
      }

      const testUrl = buildSheetsGetUrl(cleanUrl, token);
      const res = await fetch(testUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data && data.error === 'unauthorized') {
        setTestResult('🔴 보안 인증 실패: 시트에 등록된 스크립트의 토큰과 일치하지 않습니다. 아래 스크립트를 복사하여 새 버전으로 배포해 주세요.');
        return;
      }

      if (onSyncGoogleSheets) {
        await onSyncGoogleSheets(cleanUrl, Number(budget) !== 1200000 ? Number(budget) : null);
      }

      const isV2 = data && data.version === 2;
      if (isV2) {
        setTestResult('🟢 연결 성공! 보안 토큰 인증(v2)이 활성화되어 안전하게 동기화됩니다.');
      } else {
        setTestResult('🟡 연결 성공: 단, 구버전 스크립트가 실행 중입니다. 최신 보안 스크립트를 복사하여 배포하시면 중복 방지와 토큰 암호화가 적용됩니다.');
      }

      await onSaveSettings({
        gemini_api_key: apiKey.trim(),
        monthly_budget: Number(budget) || 1200000,
        google_sheets_url: cleanUrl
      });
    } catch (err) {
      setTestResult(`🔴 연결 실패: 구글 시트 웹앱 URL(/exec)과 권한(모든 사용자)을 확인해 주세요. (${err.message})`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentScriptCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Scan current local transactions for suspicious/failed AI entries or duplicates
  const handleScanSuspicious = () => {
    let list = [];
    try {
      const saved = localStorage.getItem('budget_local_transactions');
      list = saved ? JSON.parse(saved) : [];
    } catch (_) {}

    const suspicious = [];
    const seenMap = new Map();

    list.forEach(item => {
      let isBad = false;
      let reason = '';

      const merchant = String(item.merchant || '').trim();
      const amount = Number(item.amount) || 0;

      // 1. API key missing dummy text
      if (merchant.includes('API 키 등록 필요') || merchant.includes('가맹점/상호 (API')) {
        isBad = true;
        reason = 'API 키 미등록 예시 데이터';
      } else if (merchant === '미상' && amount === 0) {
        isBad = true;
        reason = '인식 실패 (상호 미상 & 0원)';
      } else if (amount <= 0) {
        isBad = true;
        reason = '0원 이하 내역';
      }

      // 2. Duplicate detection (same date, merchant, amount, type)
      const sig = `${item.date}_${item.type}_${merchant}_${amount}`;
      if (seenMap.has(sig)) {
        isBad = true;
        reason = reason ? `${reason} + 중복 내역` : '동일 내역 중복 등록';
      } else {
        seenMap.set(sig, item.id);
      }

      if (isBad) {
        suspicious.push({ ...item, reason });
      }
    });

    setSuspiciousRows(suspicious);
    setSelectedCleanupIds(new Set(suspicious.map(s => s.id)));
    setShowCleanup(true);
    setCleanupMessage(suspicious.length === 0 ? '정리가 필요한 중복·실패 내역이 없습니다.' : `총 ${suspicious.length}건의 의심 내역이 감지되었습니다.`);
  };

  const handleExecuteCleanup = async () => {
    if (selectedCleanupIds.size === 0) return;
    if (!confirm(`선택한 ${selectedCleanupIds.size}건의 내역을 영구 삭제하시겠습니까?`)) return;

    let list = [];
    try {
      const saved = localStorage.getItem('budget_local_transactions');
      list = saved ? JSON.parse(saved) : [];
    } catch (_) {}

    const remaining = list.filter(item => !selectedCleanupIds.has(item.id));
    localStorage.setItem('budget_local_transactions', JSON.stringify(remaining));

    // Push full sync to Google Sheets
    const sheetsUrl = (googleSheetsUrl || localStorage.getItem('budget_sheets_url') || '').trim();
    if (sheetsUrl) {
      try {
        await fetch(sheetsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'sync_transactions',
            transactions: remaining,
            token
          })
        });
      } catch (_) {}
    }

    setCleanupMessage(`🎉 ${selectedCleanupIds.size}건 삭제 완료! 가계부와 구글 시트가 깨끗하게 정리되었습니다.`);
    setSuspiciousRows([]);
    setSelectedCleanupIds(new Set());
    if (onRefreshData) onRefreshData();
  };

  const handleExportCsv = () => {
    window.location.href = '/api/export-csv';
  };

  const handleExportBackup = () => {
    window.location.href = '/api/backup';
  };

  const handleRestoreFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      const res = await fetch('/api/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json)
      });

      if (!res.ok) throw new Error('복원 실패');
      setRestoreStatus(`성공적으로 ${json.transactions?.length || 0}건 복원 완료!`);
      onRefreshData();
      setTimeout(() => setRestoreStatus(''), 3000);
    } catch (err) {
      alert('백업 파일 형식이 올바르지 않습니다.');
    }
  };

  return (
    <div
      onClick={handleCloseWithSave}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-900/40 backdrop-blur-xs animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-zinc-200 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-900">환경 설정</h2>
          <button
            type="button"
            onClick={handleCloseWithSave}
            className="p-2 -mr-1.5 rounded-xl hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition cursor-pointer"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* 1. Google Sheets Integration Section */}
          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Table className="w-4 h-4 text-zinc-700" />
                <h3 className="text-xs sm:text-sm font-bold text-zinc-900">
                  📊 구글 스프레드시트 연동
                </h3>
              </div>
              <a
                href="https://sheets.new"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-zinc-600 hover:text-zinc-900 underline font-medium"
              >
                새 시트 만들기 ↗
              </a>
            </div>

            <p className="text-xs text-zinc-500 leading-relaxed">
              구글 시트 URL을 등록하면 <strong>지출 내역, 목표 예산, 위시리스트</strong>가 구글 시트에 안전 보관되며 폰과 자동 동기화됩니다.
            </p>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                구글 시트 웹 앱 URL (끝이 /exec로 끝나는 주소)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={googleSheetsUrl}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGoogleSheetsUrl(val);
                    setTestResult('');
                  }}
                  className="flex-1 text-xs px-3 py-2 bg-white border border-zinc-200 rounded-xl focus:ring-1 focus:ring-zinc-600 outline-none"
                />
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting || !googleSheetsUrl.trim()}
                  className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition whitespace-nowrap flex-shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 flex-shrink-0 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>연동 & 검증</span>
                </button>
              </div>
              {testResult && (
                <div className={`mt-2 p-2 rounded-lg text-xs font-medium leading-relaxed ${
                  testResult.startsWith('🟢')
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : testResult.startsWith('🟡')
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {testResult}
                </div>
              )}
            </div>

            {/* Token Info & Code Toggle */}
            <div className="pt-1 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-zinc-500">
                <span>보안 인증 토큰: <code className="font-mono bg-zinc-200 px-1 rounded text-zinc-800">{token ? `${token.slice(0, 6)}...${token.slice(-4)}` : '없음'}</code></span>
                <button
                  type="button"
                  onClick={handleRegenerateToken}
                  className="text-zinc-600 hover:text-zinc-900 underline font-medium"
                >
                  토큰 재발급
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowCodeBox(!showCodeBox)}
                className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 underline flex items-center gap-1"
              >
                <span>{showCodeBox ? '▲ 스크립트 코드 & 연동 방법 닫기' : '▼ 1분 구글 시트 보안 스크립트 코드 복사하기'}</span>
              </button>

              {showCodeBox && (
                <div className="mt-2 p-3 bg-white rounded-xl border border-zinc-200 text-xs text-zinc-700 space-y-2">
                  <ol className="list-decimal list-inside space-y-1 text-zinc-600 leading-relaxed text-[11px]">
                    <li>구글 시트 상단 메뉴 <strong>확장 프로그램 &gt; Apps Script</strong>를 엽니다.</li>
                    <li>기존 코드를 지우고 아래 <strong>보안 토큰이 포함된 코드</strong>를 붙여넣은 뒤 저장(💾)합니다.</li>
                    <li>우측 상단 <strong>배포 &gt; 새 배포</strong>(또는 배포 관리 &gt; 새 버전) ➔ 유형: <strong>웹 앱</strong> ➔ 액세스 권한: <strong>모든 사용자(Anyone)</strong> ➔ 배포 클릭.</li>
                    <li>발급된 <strong>웹 앱 URL(/exec)</strong>을 복사하여 위 칸에 넣고 [연동 & 검증]을 누르면 끝!</li>
                  </ol>

                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-[11px] text-zinc-500">Apps Script 코드:</span>
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="px-2 py-0.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded text-[10px] font-semibold flex items-center gap-1"
                      >
                        {copiedCode ? <Check className="w-3 h-3 text-zinc-900" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedCode ? '복사됨!' : '코드 복사'}</span>
                      </button>
                    </div>
                    <pre className="p-2 bg-zinc-900 text-zinc-200 rounded-lg text-[10px] overflow-x-auto max-h-36 font-mono">
                      {currentScriptCode}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. Gemini AI Key Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-zinc-700" />
                <h3 className="text-xs sm:text-sm font-bold text-zinc-900">Gemini AI 설정</h3>
              </div>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-zinc-600 hover:text-zinc-900 underline font-medium"
              >
                무료 키 발급 ↗
              </a>
            </div>

            <input
              type="password"
              placeholder="AIzaSy... 형태의 키 입력"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-zinc-600 outline-none"
            />
            {settings?.hasApiKey && (
              <div className="text-[11px] text-zinc-500 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-zinc-700" />
                <span>API 키 등록 완료 (클라이언트에만 안전 보관)</span>
              </div>
            )}
          </div>

          <hr className="border-zinc-100" />

          {/* 3. Monthly Budget Target Section */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-zinc-700" />
              <h3 className="text-xs sm:text-sm font-bold text-zinc-900">월간 지출 목표 예산</h3>
            </div>
            <div className="relative">
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full text-sm font-bold px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-zinc-600 outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">
                {formatKRW(budget)}
              </span>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              onClick={handleSave}
              className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-xl shadow-xs transition"
            >
              {savedSuccess ? '✅ 설정 저장 완료!' : '설정 저장하기'}
            </button>
          </div>

          <hr className="border-zinc-100" />

          {/* 4. Cleanup Suspicious AI / Duplicate Records */}
          <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                <h3 className="text-xs sm:text-sm font-bold text-zinc-900">
                  🧹 중복·실패 내역 자동 정리
                </h3>
              </div>
              <button
                type="button"
                onClick={handleScanSuspicious}
                className="text-xs px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition"
              >
                의심 내역 검사
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              AI 인식 실패로 잘못 들어간 가짜 데이터나 통신 재시도로 생긴 중복 행을 찾아 깨끗이 삭제합니다.
            </p>

            {cleanupMessage && (
              <p className="text-xs font-medium text-amber-900 pt-1">{cleanupMessage}</p>
            )}

            {showCleanup && suspiciousRows.length > 0 && (
              <div className="mt-2 space-y-2">
                <div className="max-h-48 overflow-y-auto space-y-1 bg-white p-2 rounded-xl border border-amber-200">
                  {suspiciousRows.map(row => (
                    <label key={row.id} className="flex items-center gap-2 text-xs p-1.5 hover:bg-zinc-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCleanupIds.has(row.id)}
                        onChange={(e) => {
                          const next = new Set(selectedCleanupIds);
                          if (e.target.checked) next.add(row.id);
                          else next.delete(row.id);
                          setSelectedCleanupIds(next);
                        }}
                        className="rounded text-amber-600"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-zinc-800">{row.merchant || '상호없음'}</span>
                        <span className="text-zinc-500 ml-1">({formatKRW(row.amount)})</span>
                        <span className="text-zinc-400 text-[10px] ml-1">{row.date}</span>
                        <div className="text-[10px] text-rose-600 font-medium">{row.reason}</div>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-1">
                  <span className="text-[11px] text-zinc-500">{selectedCleanupIds.size}개 선택됨</span>
                  <button
                    type="button"
                    onClick={handleExecuteCleanup}
                    disabled={selectedCleanupIds.size === 0}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>선택 삭제 실행</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <hr className="border-zinc-100" />

          {/* 5. Backup & Export Section */}
          <div className="space-y-2.5">
            <h3 className="text-xs sm:text-sm font-bold text-zinc-900">데이터 백업 및 엑셀 다운로드</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                className="p-2.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-xl text-left transition flex items-center gap-2 text-xs font-semibold text-zinc-700"
              >
                <FileSpreadsheet className="w-4 h-4 text-zinc-600" />
                <span>엑셀(CSV) 저장</span>
              </button>

              <button
                type="button"
                onClick={handleExportBackup}
                className="p-2.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-xl text-left transition flex items-center gap-2 text-xs font-semibold text-zinc-700"
              >
                <Download className="w-4 h-4 text-zinc-600" />
                <span>전체 백업(JSON)</span>
              </button>
            </div>

            <label className="block p-2.5 bg-zinc-50 hover:bg-zinc-100 border border-dashed border-zinc-300 rounded-xl cursor-pointer text-center transition">
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-zinc-600">
                <Upload className="w-4 h-4 text-zinc-600" />
                <span>백업 파일 복원하기</span>
              </div>
              <input
                type="file"
                accept=".json"
                onChange={handleRestoreFile}
                className="hidden"
              />
            </label>
            {restoreStatus && (
              <p className="text-xs text-zinc-700 font-medium text-center">{restoreStatus}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
