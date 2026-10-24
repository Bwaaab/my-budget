import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  Target,
  Download,
  Upload,
  FileSpreadsheet,
  Check,
  ExternalLink,
  ShieldCheck,
  Table,
  Copy,
  RefreshCw,
  Smartphone
} from 'lucide-react';
import { formatKRW } from '../constants';

const GOOGLE_SCRIPT_CODE = `function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
  }
  var result = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row[1] && !row[4]) continue;
    var dateVal = row[1];
    var dateStr = '';
    if (dateVal instanceof Date) {
      dateStr = Utilities.formatDate(dateVal, Session.getScriptTimeZone(), "yyyy-MM-dd");
    } else {
      dateStr = String(dateVal || '');
    }
    result.push({
      id: row[0] || i,
      date: dateStr,
      time: String(row[2] || ''),
      type: row[3] === '수입' ? 'income' : 'expense',
      amount: Number(row[4]) || 0,
      category: String(row[5] || '기타'),
      merchant: String(row[6] || ''),
      payment_method: String(row[7] || ''),
      memo: String(row[8] || '')
    });
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['ID', '일자', '시간', '구분', '금액', '카테고리', '상호/사용처', '결제수단', '메모']);
  }
  var id = Date.now();
  sheet.appendRow([
    id,
    data.date,
    data.time || '',
    data.type === 'income' ? '수입' : '지출',
    Number(data.amount) || 0,
    data.category || '기타',
    data.merchant || '',
    data.payment_method || '',
    data.memo || ''
  ]);
  return ContentService.createTextOutput(JSON.stringify({ success: true, id: id })).setMimeType(ContentService.MimeType.JSON);
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

  useEffect(() => {
    if (settings) {
      setApiKey(settings.gemini_api_key || '');
      setBudget(String(settings.monthly_budget || 1200000));
      setGoogleSheetsUrl(settings.google_sheets_url || '');
    }
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    await onSaveSettings({
      gemini_api_key: apiKey,
      monthly_budget: Number(budget),
      google_sheets_url: googleSheetsUrl
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">환경 설정</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* 1. Google Sheets Integration Section */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Table className="w-4 h-4 text-emerald-700" />
                <h3 className="text-sm font-bold text-emerald-950">
                  📊 구글 스프레드시트 연동 (24시간 폰 입력)
                </h3>
              </div>
              <a
                href="https://sheets.new"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-700 hover:underline flex items-center gap-1 font-semibold"
              >
                새 구글 시트 만들기 ↗
              </a>
            </div>

            <p className="text-xs text-emerald-900/80 leading-relaxed">
              PC가 꺼져 있어도 <strong>스마트폰에서 구글 시트에 바로 저장</strong>하고, PC를 켰을 때 <strong>[구글 시트 동기화]</strong> 버튼 하나로 최신 내역을 싹 불러올 수 있습니다!
            </p>

            <div>
              <label className="block text-[11px] font-semibold text-emerald-900 mb-1">
                구글 시트 웹 앱 URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={googleSheetsUrl}
                  onChange={(e) => setGoogleSheetsUrl(e.target.value)}
                  className="flex-1 text-xs px-3 py-2 bg-white border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                {googleSheetsUrl && (
                  <button
                    type="button"
                    onClick={onSyncGoogleSheets}
                    className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>동기화</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick 1-minute setup guide toggle */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowCodeBox(!showCodeBox)}
                className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 underline flex items-center gap-1"
              >
                <span>{showCodeBox ? '▲ 연동 가이드 및 코드 닫기' : '▼ 1분 초간단 구글 시트 연동 방법 & 코드 보기'}</span>
              </button>

              {showCodeBox && (
                <div className="mt-2.5 p-3 bg-white rounded-xl border border-emerald-200 text-xs text-slate-700 space-y-2">
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 leading-relaxed text-[11px]">
                    <li><a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-bold">새 구글 시트</a>를 엽니다.</li>
                    <li>상단 메뉴에서 <strong>확장 프로그램 &gt; Apps Script</strong>를 클릭합니다.</li>
                    <li>기존 내용을 지우고 아래 스크립트 코드를 붙여넣은 뒤 <strong>저장(💾)</strong>합니다.</li>
                    <li>우측 상단 <strong>배포 &gt; 새 배포</strong> 클릭 &gt; 유형 선택(톱니바퀴) <strong>'웹 앱'</strong> 선택.</li>
                    <li>액세스 권한을 <strong>'모든 사용자(Anyone)'</strong>로 설정 후 <strong>배포</strong> 클릭.</li>
                    <li>발급된 <strong>웹 앱 URL</strong>을 복사하여 위 칸에 붙여넣으면 끝!</li>
                  </ol>

                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-[11px] text-slate-500">Apps Script 코드:</span>
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-semibold flex items-center gap-1"
                      >
                        {copiedCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedCode ? '복사됨!' : '코드 복사'}</span>
                      </button>
                    </div>
                    <pre className="p-2 bg-slate-900 text-slate-200 rounded-lg text-[10px] overflow-x-auto max-h-36 font-mono">
                      {GOOGLE_SCRIPT_CODE}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. Gemini AI Key Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Gemini Vision AI 설정</h3>
              </div>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-medium"
              >
                무료 API 키 발급 ↗
              </a>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Google AI Studio의 무료 API 키를 등록하면 종이 영수증 및 카드 결제 알림 캡처본을 실시간 자동 분석합니다.
            </p>

            <div className="flex gap-2">
              <input
                type="password"
                placeholder="AIzaSy... 형태의 키 입력"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="flex-1 text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            {settings?.hasApiKey && (
              <div className="text-[11px] text-emerald-600 flex items-center gap-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>API 키가 정상 등록되어 있습니다.</span>
              </div>
            )}
          </div>

          <hr className="border-slate-100" />

          {/* 3. Monthly Budget Target Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">월간 지출 목표 예산</h3>
            </div>
            <div className="relative">
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full text-base font-bold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                {formatKRW(budget)}
              </span>
            </div>
            <div className="flex gap-1.5">
              {[500000, 1000000, 1500000, 2000000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setBudget(String(amt))}
                  className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition"
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
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-sm transition flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{savedSuccess ? '설정 저장 완료!' : '설정 저장하기'}</span>
            </button>
          </div>

          <hr className="border-slate-100" />

          {/* 4. Backup & Export Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">데이터 백업 및 엑셀 내보내기</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition flex items-center gap-2 text-xs font-semibold text-slate-700"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>엑셀(CSV) 다운로드</span>
              </button>

              <button
                type="button"
                onClick={handleExportBackup}
                className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition flex items-center gap-2 text-xs font-semibold text-slate-700"
              >
                <Download className="w-4 h-4 text-blue-600" />
                <span>전체 백업(JSON)</span>
              </button>
            </div>

            <label className="block p-3 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl cursor-pointer text-center transition">
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-600">
                <Upload className="w-4 h-4 text-indigo-600" />
                <span>백업 파일에서 데이터 복원하기</span>
              </div>
              <input
                type="file"
                accept=".json"
                onChange={handleRestoreFile}
                className="hidden"
              />
            </label>
            {restoreStatus && (
              <p className="text-xs text-emerald-600 font-medium text-center">{restoreStatus}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
