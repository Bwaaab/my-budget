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
  RefreshCw
} from 'lucide-react';
import { formatKRW } from '../constants';

const GOOGLE_SCRIPT_CODE = `function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Transactions (가계부 내역)
  var txSheet = ss.getSheetByName('가계부') || ss.getActiveSheet();
  var txValues = txSheet.getDataRange().getValues();
  var transactions = [];
  if (txValues.length > 1) {
    for (var i = 1; i < txValues.length; i++) {
      var row = txValues[i];
      if (!row[1] && !row[4]) continue;
      var dateVal = row[1];
      var dateStr = (dateVal instanceof Date) ? Utilities.formatDate(dateVal, Session.getScriptTimeZone(), "yyyy-MM-dd") : String(dateVal || '');
      transactions.push({
        id: row[0] || i,
        date: dateStr,
        time: String(row[2] || ''),
        type: row[3] === '수입' ? 'income' : (row[3] === '저축' || row[5] === '저축/투자') ? 'saving' : 'expense',
        amount: Number(row[4]) || 0,
        category: String(row[5] || '기타'),
        merchant: String(row[6] || ''),
        payment_method: String(row[7] || ''),
        memo: String(row[8] || '')
      });
    }
  }

  // 2. Wishlist (위시리스트 - 살 것)
  var wishSheet = ss.getSheetByName('위시리스트');
  var wishlist = [];
  if (wishSheet) {
    var wishValues = wishSheet.getDataRange().getValues();
    if (wishValues.length > 1) {
      for (var j = 1; j < wishValues.length; j++) {
        var w = wishValues[j];
        if (!w[1]) continue;
        var wDateVal = w[8];
        var wDateStr = (wDateVal instanceof Date) ? Utilities.formatDate(wDateVal, Session.getScriptTimeZone(), "yyyy-MM-dd") : String(wDateVal || '');
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

  return ContentService.createTextOutput(JSON.stringify({
    transactions: transactions,
    wishlist: wishlist,
    settings: { monthly_budget: monthly_budget, gemini_api_key: gemini_api_key }
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var payload = JSON.parse(e.postData.contents);
  var action = payload.action || 'add_transaction';

  // 지출/수입 단건 등록
  if (action === 'add_transaction') {
    var txSheet = ss.getSheetByName('가계부') || ss.getActiveSheet();
    if (txSheet.getName() !== '가계부') txSheet.setName('가계부');
    if (txSheet.getLastRow() === 0) {
      txSheet.appendRow(['ID', '일자', '시간', '구분', '금액', '카테고리', '상호/사용처', '결제수단', '메모']);
    }
    var id = payload.id || Date.now();
    txSheet.appendRow([
      id,
      payload.date,
      payload.time || '',
      payload.type === 'income' ? '수입' : (payload.type === 'saving' || payload.category === '저축/투자') ? '저축' : '지출',
      Number(payload.amount) || 0,
      payload.category || '기타',
      payload.merchant || '',
      payload.payment_method || '',
      payload.memo || ''
    ]);
    return ContentService.createTextOutput(JSON.stringify({ success: true, id: id })).setMimeType(ContentService.MimeType.JSON);
  }

  // 지출/수입 전체 동기화 (수정·삭제 반영)
  if (action === 'sync_transactions') {
    var allTxSheet = ss.getSheetByName('가계부') || ss.getActiveSheet();
    if (allTxSheet.getName() !== '가계부') allTxSheet.setName('가계부');
    allTxSheet.clear();
    allTxSheet.appendRow(['ID', '일자', '시간', '구분', '금액', '카테고리', '상호/사용처', '결제수단', '메모']);
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
          t.memo || ''
        ]);
      });
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
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
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
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
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
}`;

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
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showCodeBox, setShowCodeBox] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState('');
  const [testResult, setTestResult] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  // Only populate fields when modal opens so background syncs don't reset user's typing
  useEffect(() => {
    if (isOpen) {
      const savedKey = settings?.gemini_api_key || localStorage.getItem('budget_gemini_key') || '';
      const savedBudget = Number(localStorage.getItem('budget_monthly_target')) || settings?.monthly_budget || 1200000;
      const savedUrl = localStorage.getItem('budget_sheets_url') || settings?.google_sheets_url || '';
      setApiKey(savedKey);
      setBudget(String(savedBudget));
      setGoogleSheetsUrl(savedUrl);
      setTestResult('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

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

  // Close immediately (0ms) and only save in background if user actually modified a field
  const handleCloseWithSave = () => {
    const cleanUrl = googleSheetsUrl.trim();
    const isValidUrl = !cleanUrl || (!cleanUrl.includes('/macros/library/') && cleanUrl.startsWith('http'));
    const prevKey = (settings?.gemini_api_key || localStorage.getItem('budget_gemini_key') || '').trim();
    const prevBudget = Number(localStorage.getItem('budget_monthly_target')) || settings?.monthly_budget || 1200000;
    const prevUrl = (localStorage.getItem('budget_sheets_url') || settings?.google_sheets_url || '').trim();

    const nextKey = apiKey.trim();
    const nextBudget = Number(budget) || 1200000;
    const nextUrl = isValidUrl ? cleanUrl : prevUrl;

    // 1. Close modal immediately so X button feels instant
    onClose();

    // 2. If anything changed, persist in background
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
      setTestResult('🔴 라이브러리 주소(/library/)가 입력되었습니다. Apps Script 우측 상단 [배포] > [새 배포] > 유형 [웹 앱]에서 끝이 /exec로 끝나는 URL을 복사해 주세요.');
      return;
    }

    setIsTesting(true);
    setTestResult('구글 시트와 통신 및 동기화 중...');

    try {
      // Save URL first
      localStorage.setItem('budget_sheets_url', cleanUrl);
      if (apiKey.trim()) {
        localStorage.setItem('budget_gemini_key', apiKey.trim());
      }

      // 1. Verify GET connection & pull existing settings/API key/budget from Google Sheets
      const res = await fetch(`${cleanUrl}${cleanUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await res.json();

      if (onSyncGoogleSheets) {
        await onSyncGoogleSheets(cleanUrl, Number(budget) !== 1200000 ? Number(budget) : null);
      }

      // 2. Reflect synced values in modal inputs & ensure local settings are saved
      const syncedKey = apiKey.trim() || localStorage.getItem('budget_gemini_key') || '';
      const syncedBudget = Number(localStorage.getItem('budget_monthly_target')) || Number(budget) || 1200000;
      if (syncedKey) setApiKey(syncedKey);
      if (syncedBudget) setBudget(String(syncedBudget));

      await onSaveSettings({
        gemini_api_key: syncedKey,
        monthly_budget: syncedBudget,
        google_sheets_url: cleanUrl
      });

      setTestResult('🟢 연결 성공! 지출 내역·위시리스트·목표 예산·AI 키가 모두 동기화되었습니다.');
    } catch (err) {
      setTestResult(`🔴 연결 실패: 구글 시트 웹앱 URL(/exec)과 액세스 권한(모든 사용자)을 확인해 주세요. (${err.message})`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(GOOGLE_SCRIPT_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
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
                  📊 구글 스프레드시트 연동 (지출·위시리스트·예산 통합)
                </h3>
              </div>
              <a
                href="https://sheets.new"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-zinc-600 hover:text-zinc-900 underline font-medium"
              >
                새 구글 시트 만들기 ↗
              </a>
            </div>

            <p className="text-xs text-zinc-500 leading-relaxed">
              구글 시트 URL을 등록하면 <strong>지출 내역, 목표 예산, 위시리스트까지 전부 구글 시트에 안전 저장</strong>되며 폰과 PC가 자동 동기화됩니다. (100% 무료)
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
                    if (val.includes('/macros/library/')) {
                      setTestResult('🔴 라이브러리 주소(/library/)입니다! [배포] > [새 배포]에서 끝이 /exec로 끝나는 웹 앱 URL을 복사해 주세요.');
                    } else {
                      setTestResult('');
                      if (val.trim().startsWith('https://script.google.com/macros/s/')) {
                        localStorage.setItem('budget_sheets_url', val.trim());
                      }
                    }
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
                  <span>연동 & 저장</span>
                </button>
              </div>
              {testResult && (
                <div className={`mt-2 p-2 rounded-lg text-xs font-medium ${
                  testResult.startsWith('🟢') ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {testResult}
                </div>
              )}
            </div>

            {/* Quick 1-minute setup guide toggle */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowCodeBox(!showCodeBox)}
                className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 underline flex items-center gap-1"
              >
                <span>{showCodeBox ? '▲ 스크립트 코드 & 연동 방법 닫기' : '▼ 1분 구글 시트 연동 스크립트 코드 복사하기'}</span>
              </button>

              {showCodeBox && (
                <div className="mt-2.5 p-3 bg-white rounded-xl border border-zinc-200 text-xs text-zinc-700 space-y-2">
                  <ol className="list-decimal list-inside space-y-1 text-zinc-600 leading-relaxed text-[11px]">
                    <li><a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-zinc-900 underline font-bold">새 구글 시트</a>를 엽니다.</li>
                    <li>상단 메뉴에서 <strong>확장 프로그램 &gt; Apps Script</strong>를 클릭합니다.</li>
                    <li>기존 내용을 지우고 아래 스크립트 코드를 붙여넣은 뒤 <strong>저장(💾)</strong>합니다.</li>
                    <li>우측 상단 <strong>배포 &gt; 새 배포</strong> 클릭 ➔ 유형 선택 <strong>'웹 앱'</strong> ➔ 액세스 권한 <strong>'모든 사용자(Anyone)'</strong> 선택 ➔ <strong>배포</strong> 클릭.</li>
                    <li>발급된 <strong>웹 앱 URL</strong>을 복사하여 위 칸에 붙여넣으면 끝!</li>
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
                      {GOOGLE_SCRIPT_CODE}
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
                <h3 className="text-xs sm:text-sm font-bold text-zinc-900">Gemini 3.8 AI 설정</h3>
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
                <span>API 키 등록 완료</span>
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
                onChange={(e) => {
                  setBudget(e.target.value);
                  if (Number(e.target.value) > 0) {
                    localStorage.setItem('budget_monthly_target', String(Number(e.target.value)));
                  }
                }}
                className="w-full text-sm font-bold px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-zinc-600 outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">
                {formatKRW(budget)}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[300000, 400000, 500000, 800000, 1000000, 1500000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    setBudget(String(amt));
                    localStorage.setItem('budget_monthly_target', String(amt));
                  }}
                  className={`px-2.5 py-1 text-[11px] rounded-lg font-medium transition ${
                    Number(budget) === amt
                      ? 'bg-zinc-900 text-white font-bold'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                  }`}
                >
                  {amt / 10000}만
                </button>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              onClick={handleSave}
              className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-xl shadow-xs transition"
            >
              {savedSuccess ? '✅ 설정 및 구글 시트 저장 완료!' : '설정 저장하기'}
            </button>
          </div>

          <hr className="border-zinc-100" />

          {/* 4. Backup & Export Section */}
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
