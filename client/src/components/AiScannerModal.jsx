import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Camera,
  Sparkles,
  Check,
  AlertCircle,
  Key,
  Receipt,
  RotateCcw,
  Eye,
  EyeOff
} from 'lucide-react';
import { CATEGORIES, PAYMENT_METHODS, formatKRW, getNecessity, cleanNumber, normalizeDateYMD, normalizeTimeHM, todayYMD, nowHM, getMerchantFieldInfo } from '../constants';

const createEmptyAiFormData = () => ({
  type: 'expense',
  pointMode: 'earn',
  necessity: 'need',
  amount: '',
  merchant: '',
  date: todayYMD(),
  time: nowHM(),
  category: '식비',
  payment_method: '신용카드',
  memo: '',
  items: [],
  image_path: ''
});

// Compress & resize image on client (max 768px, JPEG 0.80)
// Why 768px? Gemini Vision processes <=768px images as a SINGLE 258-token tile (vs 6x tokens for >768px),
// making image queries almost as fast as pure text queries (~0.8-1.2s) while keeping Korean text crisp.
function compressImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX_DIM = 768;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      resolve({
        base64: dataUrl.split(',')[1],
        mimeType: 'image/jpeg'
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = () => resolve({ base64: reader.result.split(',')[1], mimeType: file.type || 'image/jpeg' });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    };
    img.src = objectUrl;
  });
}

// 제외할 특수 목적 모델 키워드 (TTS, Live, Nano Banana 이미지 생성 등)
function isExcludedModel(name = '') {
  const lower = name.toLowerCase();
  return (
    lower.includes('tts') ||
    lower.includes('live') ||
    lower.includes('banana') ||
    lower.includes('nano') ||
    lower.includes('image') ||
    lower.includes('imagen') ||
    lower.includes('audio') ||
    lower.includes('embedding') ||
    lower.includes('veo') ||
    lower.includes('aqa') ||
    lower.includes('robotics') ||
    lower.includes('computer-use') ||
    lower.includes('pro')
  );
}

// Prioritize ultra-fast 3.5 Flash-Lite & 3.1 Flash-Lite first, then 3.6 Flash, then 3.8 Flash
let cachedActiveModel = localStorage.getItem('budget_verified_gemini_model') || null;

async function getOrderedAvailableModels(cleanKey) {
  if (cachedActiveModel) {
    return [cachedActiveModel];
  }

  const preferredOrder = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite-preview',
    'gemini-3.1-flash-lite-preview',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-flash-lite-latest',
    'gemini-flash-latest'
  ];

  try {
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`
    );
    if (listRes.ok) {
      const listData = await listRes.json();
      const validServerModels = (listData.models || [])
        .filter(
          m =>
            (m.supportedGenerationMethods || []).includes('generateContent') &&
            m.name.includes('gemini') &&
            !isExcludedModel(m.name) &&
            !isExcludedModel(m.displayName)
        )
        .map(m => m.name.replace(/^models\//, ''));

      if (validServerModels.length > 0) {
        // Put Flash-Lite models (3.5-flash-lite, 3.1-flash-lite) strictly at the top for maximum speed
        const liteModels = validServerModels.filter(m => m.includes('flash-lite') || m.includes('lite'));
        const flashModels = validServerModels.filter(m => m.includes('flash') && !liteModels.includes(m));
        const ranked = [
          ...preferredOrder.filter(p => validServerModels.includes(p)),
          ...liteModels.filter(m => !preferredOrder.includes(m)),
          ...flashModels.filter(m => !preferredOrder.includes(m))
        ];
        if (ranked.length > 0) {
          return ranked;
        }
      }
    }
  } catch (_) {}

  return preferredOrder;
}

async function analyzeDirectWithGemini(base64Data, mimeType, apiKey) {
  const cleanKey = (apiKey || '').trim();
  const currentYear = new Date().getFullYear();
  const prompt = `한국 가계부 결제/영수증/이체/투자/포인트 캡처 이미지에서 JSON을 추출하세요.

필수 규칙:
1. amount: 화면의 '수수료 0원', '할인 0원' 등이 아니라, **실제로 결제/출금/이체/투자/적립된 총 핵심 금액**을 쉼표 없는 정수 숫자로만 추출하세요. (예: 15000, 4800, 250000). 만약 네이버페이 포인트 적립/내역 단독 캡처 화면이라면 해당 포인트 금액을 amount로 추출하세요.
2. date: 거래 일자는 "YYYY-MM-DD" 형식 (연도가 없으면 반드시 현재 연도 ${currentYear} 적용).
3. merchant: 상호명, 가맹점명, 수취인, 투자종목명, 또는 포인트 적립/사용 사유 (예: "스타벅스", "배달의민족", "토스증권 S&P500", "네이버페이 구매 적립").
4. type:
   - 일반 지출은 "expense"
   - 주식/ETF/적금/예금/ISA/연금/청약 납입은 "saving"
   - 급여/환급/입금은 "income"
   - **네이버페이 등 포인트 적립 내역/이벤트 적립 단독 캡처 화면**이면 "point_earn"
   - **네이버페이 등 포인트 차감/사용 내역 단독 캡처 화면**이면 "point_use"
5. necessity: 필수 생활비(기본 식비, 마트, 교통, 공과금, 병원)는 "need", 선택적/아낄 수 있었던 소비(카페/디저트, 배달야식, 쇼핑, 택시, 여가)는 "want".
6. category: "식비"|"카페/간식"|"마트/생필품"|"교통"|"문화/여가"|"쇼핑"|"의료/건강"|"주거/통신"|"저축/투자"|"급여"|"포인트"|"기타".
7. payment_method: "신용카드"|"체크카드"|"네이버페이"|"네이버페이(포인트)"|"카카오페이"|"토스페이"|"계좌이체"|"현금" 등.
8. memo: 핵심 품목 또는 간단 요약.
9. earned_point: 일반 결제/영수증 화면 하단에 부가적으로 "N원 적립", "네이버페이 포인트 N원 적립" 등의 혜택 문구가 함께 보일 경우 적립 포인트 숫자 (없거나 이미 type이 "point_earn"이면 0).

출력 JSON 형식만 반환하세요:
{"type":"expense","necessity":"need","amount":숫자,"merchant":"상호명","date":"${currentYear}-MM-DD","time":"HH:mm","category":"식비","payment_method":"신용카드","memo":"품목","earned_point":0}`;

  const models = await getOrderedAvailableModels(cleanKey);

  const callModel = async (modelName) => {
    const cleanModel = modelName.replace(/^models\//, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${encodeURIComponent(cleanKey)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64Data } }
          ]
        }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 1024,
          response_mime_type: 'application/json'
        }
      })
    });

    if (!res.ok) {
      let detail = '';
      try {
        const errJson = await res.json();
        detail = errJson?.error?.message || '';
      } catch (_) {}

      const err = new Error(
        res.status === 400 || res.status === 403
          ? 'API 키가 유효하지 않거나 권한이 없습니다. 설정에서 Gemini API 키를 확인해 주세요.'
          : res.status === 429
          ? '무료 AI 호출 한도(분당 요청 수)를 초과했습니다. 잠시 후 다시 시도해 주세요.'
          : `AI 서버 응답 오류 (${res.status}${detail ? ': ' + detail : ''})`
      );
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const txt = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!txt) throw new Error('AI 응답이 비어 있습니다.');
    const cleaned = txt.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned);
  };

  let lastError = null;
  for (const model of models) {
    try {
      const result = await callModel(model);
      cachedActiveModel = model;
      localStorage.setItem('budget_verified_gemini_model', model);
      return result;
    } catch (err) {
      if (cachedActiveModel === model) {
        cachedActiveModel = null;
        localStorage.removeItem('budget_verified_gemini_model');
      }
      if (err.status && err.status !== 404) {
        lastError = err;
      } else if (!lastError) {
        lastError = err;
      }
      if (err.status === 400 || err.status === 403) {
        throw err;
      }
    }
  }

  throw lastError || new Error('AI 분석 실패');
}

export default function AiScannerModal({
  isOpen,
  onClose,
  onSaveTransaction,
  onSavePointTransaction,
  hasApiKey,
  onSaveApiKey,
  initialFile
}) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [requiresKey, setRequiresKey] = useState(false);
  const [inputKey, setInputKey] = useState(() => localStorage.getItem('budget_gemini_key') || '');
  const [showInputKey, setShowInputKey] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [savedKeySuccess, setSavedKeySuccess] = useState(false);

  // Point bonus detection
  const [detectedEarnedPoint, setDetectedEarnedPoint] = useState(0);
  const [recordPointSync, setRecordPointSync] = useState(true);

  // Extracted/Edited form state
  const [formData, setFormData] = useState(createEmptyAiFormData);
  const merchantField = getMerchantFieldInfo(formData.type, formData.pointMode);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // If initial file is passed (e.g. from global paste)
  useEffect(() => {
    if (initialFile && isOpen) {
      processFile(initialFile);
    }
  }, [initialFile, isOpen]);

  // Clean up preview url and reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setPreviewUrl('');
      setIsAnalyzing(false);
      setErrorMsg('');
      setRequiresKey(false);
      setIsSubmitting(false);
      setDetectedEarnedPoint(0);
      setRecordPointSync(true);
      setFormData(createEmptyAiFormData());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const processFile = async (selectedFile) => {
    if (!selectedFile || !selectedFile.type.startsWith('image/')) {
      setErrorMsg('이미지 파일(PNG, JPG, WEBP 등)을 선택해 주세요.');
      return;
    }

    setFile(selectedFile);
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    setErrorMsg('');
    setIsAnalyzing(true);
    setFormData(createEmptyAiFormData());

    try {
      let data = null;
      const apiKey = (localStorage.getItem('budget_gemini_key') || '').trim();

      // 1. Direct Client-side Gemini (Fastest — uses compressed image & cached model without extra hop)
      if (apiKey) {
        const { base64, mimeType } = await compressImageToBase64(selectedFile);
        const extracted = await analyzeDirectWithGemini(base64, mimeType, apiKey);
        data = { success: true, extracted, savedImagePath: objectUrl };
      } else if (!window.location.hostname.includes('github.io')) {
        // 2. Fallback to local backend server only if no client API key is stored
        try {
          const form = new FormData();
          form.append('image', selectedFile);
          const res = await fetch('/api/ai/recognize', {
            method: 'POST',
            body: form
          });
          if (res.ok) {
            data = await res.json();
          }
        } catch (_) {}
      }

      if (!data) {
        setRequiresKey(true);
        setIsAnalyzing(false);
        return;
      }

      if (data.requiresKey) {
        setRequiresKey(true);
      }

      if (data.extracted) {
        const isPoint =
          data.extracted.type === 'point' ||
          data.extracted.type === 'point_earn' ||
          data.extracted.type === 'point_use' ||
          data.extracted.category === '포인트' ||
          data.extracted.payment_method === '네이버페이(포인트)';

        const isSaving =
          !isPoint &&
          (data.extracted.type === 'saving' ||
            data.extracted.category === '저축/투자' ||
            data.extracted.category === '저축' ||
            data.extracted.category === '투자');

        const cleanAmt = cleanNumber(data.extracted.amount) || (isPoint ? cleanNumber(data.extracted.earned_point) : 0);
        const cleanDate = normalizeDateYMD(data.extracted.date);
        const cleanTime = normalizeTimeHM(data.extracted.time) || new Date().toTimeString().slice(0, 5);
        const detectedBonus = isPoint ? 0 : cleanNumber(data.extracted.earned_point);

        setDetectedEarnedPoint(detectedBonus);
        setRecordPointSync(detectedBonus > 0);

        setFormData({
          type: isPoint ? 'point' : isSaving ? 'saving' : data.extracted.type || 'expense',
          pointMode: data.extracted.type === 'point_use' ? 'use' : 'earn',
          necessity: isSaving ? 'need' : (data.extracted.necessity || getNecessity(data.extracted)),
          amount: cleanAmt > 0 ? String(cleanAmt) : '',
          merchant: data.extracted.merchant || (isPoint ? '네이버페이 포인트 적립' : ''),
          date: cleanDate,
          time: cleanTime,
          category: isPoint ? '포인트' : isSaving ? '저축/투자' : data.extracted.category || '기타',
          payment_method: isPoint ? '네이버페이(포인트)' : data.extracted.payment_method || (isSaving ? '계좌이체' : '신용카드'),
          memo: data.extracted.memo || '',
          items: data.extracted.items || [],
          image_path: data.savedImagePath || objectUrl
        });
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || '영수증 인식에 실패했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleSaveApiKeyInline = async () => {
    const cleanKey = inputKey.trim();
    if (!cleanKey) return;
    setIsSavingKey(true);
    setErrorMsg('');
    try {
      localStorage.setItem('budget_gemini_key', cleanKey);
      await onSaveApiKey(cleanKey);
      setRequiresKey(false);
      setSavedKeySuccess(true);
      setTimeout(() => setSavedKeySuccess(false), 3000);
      // Re-analyze with newly configured key if a file is already loaded
      if (file) {
        processFile(file);
      }
    } catch (err) {
      setErrorMsg('API 키 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const cleanAmt = cleanNumber(formData.amount);
    const cleanMerchant = (formData.merchant || '').trim();

    if (!cleanAmt || !cleanMerchant) {
      setErrorMsg('금액(0원 초과)과 상호(사용처)를 올바르게 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const savedDate = normalizeDateYMD(formData.date) || todayYMD();
      const savedTime = normalizeTimeHM(formData.time) || nowHM();

      if (formData.type === 'point') {
        const isUse = formData.pointMode === 'use';
        onSaveTransaction({
          ...formData,
          type: isUse ? 'expense' : 'income',
          category: '포인트',
          payment_method: '네이버페이(포인트)',
          necessity: isUse ? 'need' : undefined,
          amount: cleanAmt,
          merchant: cleanMerchant,
          date: savedDate,
          time: savedTime
        });
      } else {
        onSaveTransaction({
          ...formData,
          amount: cleanAmt,
          merchant: cleanMerchant,
          date: savedDate,
          time: savedTime
        });

        // Synchronously record detected point bonus into the unified transaction list if toggled
        if (recordPointSync && detectedEarnedPoint > 0) {
          setTimeout(() => {
            onSaveTransaction({
              type: 'income',
              category: '포인트',
              payment_method: '네이버페이(포인트)',
              amount: detectedEarnedPoint,
              merchant: `${cleanMerchant} 포인트 적립`,
              date: savedDate,
              time: savedTime,
              memo: 'AI 캡처 적립 혜택 자동 인식'
            });
          }, 50);
        }
      }

      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-900/60 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden my-auto max-h-[92vh] flex flex-col border border-slate-100">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-zinc-900">
                AI 캡처 인식
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Missing API Key Guidance Banner */}
          {((!hasApiKey && !localStorage.getItem('budget_gemini_key')) || requiresKey) && (
            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200/80 text-amber-900 text-xs sm:text-sm">
              <div className="flex items-start gap-2.5">
                <Key className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="font-semibold text-amber-800">
                    💡 무료 Gemini API 키를 등록하면 실시간 AI 인식이 작동합니다!
                  </p>
                  <p className="text-amber-700 text-xs">
                    신용카드사 결제 알림 문자, 토스/카카오페이 송금증, 영수증 캡처본을 정밀 분석합니다. (완전 무료)
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <div className="relative flex-1">
                      <input
                        type={showInputKey ? 'text' : 'password'}
                        placeholder="AI Studio에서 발급받은 Gemini API 키 붙여넣기"
                        value={inputKey}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInputKey(val);
                          if (val.trim()) {
                            localStorage.setItem('budget_gemini_key', val.trim());
                          }
                        }}
                        className="w-full pl-3 pr-8 py-1.5 bg-white rounded-xl border border-amber-300 text-xs outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowInputKey(!showInputKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 p-1 rounded"
                        title={showInputKey ? '키 가리기' : '키 보기'}
                      >
                        {showInputKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={handleSaveApiKeyInline}
                        disabled={isSavingKey || !inputKey.trim()}
                        className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white font-medium text-xs rounded-xl shadow-xs transition cursor-pointer"
                      >
                        {isSavingKey ? '저장 중...' : '키 저장 & 인식'}
                      </button>
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 bg-white border border-amber-300 text-amber-800 text-xs rounded-xl hover:bg-amber-100/50 flex items-center gap-1 transition"
                      >
                        무료 키 받기 ↗
                      </a>
                    </div>
                  </div>

                  {savedKeySuccess && (
                    <div className="text-[11px] text-emerald-800 font-medium flex items-center gap-1 pt-1">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>API 키가 안전하게 저장되었습니다! 이제 영수증을 올려주세요.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Upload Dropzone & Actions */}
          {!previewUrl ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-zinc-300 rounded-3xl p-8 text-center hover:border-zinc-500 hover:bg-zinc-50/50 transition-all cursor-pointer flex flex-col items-center justify-center space-y-3"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-16 h-16 rounded-2xl bg-zinc-100 text-zinc-900 border border-zinc-200 flex items-center justify-center">
                <Upload className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-sm sm:text-base font-bold text-zinc-800">
                  캡처본이나 영수증 이미지를 여기에 올려주세요
                </h4>
                <p className="text-xs text-zinc-400 mt-1">
                  또는 화면 어디서든 <kbd className="px-1.5 py-0.5 bg-zinc-100 rounded text-zinc-600 font-semibold border border-zinc-200">Ctrl+V</kbd> 로 붙여넣으세요
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-black rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  <Upload className="w-4 h-4" />
                  파일 선택
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-4 py-2 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition flex items-center gap-1.5"
                >
                  <Camera className="w-4 h-4 text-zinc-700" />
                  카메라 촬영
                </button>
              </div>

              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          ) : (
            /* Split View: Image Preview + AI Form */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Image Preview & Scanning Effect */}
              <div className="bg-slate-900 rounded-2xl overflow-hidden relative min-h-[220px] max-h-[360px] flex items-center justify-center border border-slate-200">
                <img
                  src={previewUrl}
                  alt="Receipt Preview"
                  className={`max-h-full max-w-full object-contain ${
                    isAnalyzing ? 'opacity-70 blur-[1px]' : ''
                  }`}
                />

                {/* Laser Scanning Animation when analyzing */}
                {isAnalyzing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80">
                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-white to-transparent absolute animate-bounce" />
                    <div className="bg-zinc-900/90 text-white px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-2 shadow-lg border border-zinc-700">
                      <Sparkles className="w-4 h-4 text-zinc-300 animate-spin" />
                      <span>AI가 정보를 정밀 분석하고 있습니다...</span>
                    </div>
                  </div>
                )}

                {/* Retake / Change Image Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-2 right-2 bg-zinc-900/80 hover:bg-zinc-900 text-white text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 border border-zinc-700 shadow transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  다른 사진 선택
                </button>
              </div>

              {/* Extracted Form Inputs */}
              <form onSubmit={handleSubmit} className="space-y-3">
                {errorMsg && (
                  <div className="p-2.5 bg-rose-50 text-rose-700 text-xs rounded-xl flex items-center gap-1.5 border border-rose-200">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Type Selection */}
                <div className="flex bg-zinc-100 rounded-xl p-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        type: 'expense',
                        category: ['저축/투자', '포인트'].includes(formData.category) ? '식비' : formData.category,
                        payment_method: formData.payment_method === '네이버페이(포인트)' ? '신용카드' : formData.payment_method
                      })
                    }
                    className={`flex-1 py-1.5 rounded-lg transition whitespace-nowrap ${
                      formData.type === 'expense'
                        ? 'bg-zinc-900 text-white shadow-xs'
                        : 'text-zinc-600'
                    }`}
                  >
                    지출
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        type: 'saving',
                        category: '저축/투자',
                        payment_method: '계좌이체'
                      })
                    }
                    className={`flex-1 py-1.5 rounded-lg transition whitespace-nowrap ${
                      formData.type === 'saving'
                        ? 'bg-zinc-900 text-white shadow-xs'
                        : 'text-zinc-600'
                    }`}
                  >
                    저축 · 투자
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        type: 'income',
                        category: ['저축/투자', '포인트'].includes(formData.category) ? '급여' : formData.category,
                        payment_method: formData.payment_method === '네이버페이(포인트)' ? '계좌이체' : formData.payment_method
                      })
                    }
                    className={`flex-1 py-1.5 rounded-lg transition whitespace-nowrap ${
                      formData.type === 'income'
                        ? 'bg-zinc-900 text-white shadow-xs'
                        : 'text-zinc-600'
                    }`}
                  >
                    수입
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        type: 'point',
                        pointMode: formData.pointMode || 'earn',
                        category: '포인트',
                        payment_method: '네이버페이(포인트)'
                      })
                    }
                    className={`flex-1 py-1.5 rounded-lg transition whitespace-nowrap ${
                      formData.type === 'point'
                        ? 'bg-zinc-900 text-white shadow-xs'
                        : 'text-zinc-600'
                    }`}
                  >
                    포인트
                  </button>
                </div>

                {/* Point Mode Toggle (Only for point) */}
                {formData.type === 'point' && (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      포인트 구분
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 bg-zinc-100 p-1 rounded-xl text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, pointMode: 'earn' })}
                        className={`py-1.5 px-2.5 rounded-lg transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                          formData.pointMode !== 'use'
                            ? 'bg-zinc-900 text-white shadow-xs font-bold'
                            : 'text-zinc-500 hover:text-zinc-900'
                        }`}
                      >
                        <span>+ 적립</span>
                        <span className={`text-[10px] ${formData.pointMode !== 'use' ? 'text-zinc-300' : 'text-zinc-400'}`}>(모은 포인트)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, pointMode: 'use' })}
                        className={`py-1.5 px-2.5 rounded-lg transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                          formData.pointMode === 'use'
                            ? 'bg-zinc-900 text-white shadow-xs font-bold'
                            : 'text-zinc-500 hover:text-zinc-900'
                        }`}
                      >
                        <span>- 사용</span>
                        <span className={`text-[10px] ${formData.pointMode === 'use' ? 'text-zinc-300' : 'text-zinc-400'}`}>(쓴 포인트)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Necessity Toggle (Only for expense) */}
                {formData.type === 'expense' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      지출 성격
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, necessity: 'need' })}
                        className={`py-1.5 px-2.5 rounded-lg transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                          formData.necessity !== 'want'
                            ? 'bg-zinc-900 text-white shadow-xs font-bold'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${formData.necessity !== 'want' ? 'bg-zinc-200' : 'bg-slate-400'}`} />
                        <span>필수</span>
                        <span className={`text-[10px] ${formData.necessity !== 'want' ? 'text-zinc-300' : 'text-slate-400'}`}>(생활비)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, necessity: 'want' })}
                        className={`py-1.5 px-2.5 rounded-lg transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                          formData.necessity === 'want'
                            ? 'bg-zinc-900 text-white shadow-xs font-bold'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${formData.necessity === 'want' ? 'bg-zinc-400' : 'bg-slate-400'}`} />
                        <span>선택</span>
                        <span className={`text-[10px] ${formData.necessity === 'want' ? 'text-zinc-300' : 'text-slate-400'}`}>(아낄 돈)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Amount */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {formData.type === 'point' ? '포인트 금액 (P)' : '금액 (원)'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      placeholder="0"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full text-lg sm:text-xl font-extrabold px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-zinc-900 outline-none transition"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">
                      {formData.amount
                        ? formData.type === 'point'
                          ? `${formatKRW(formData.amount).replace('원', '')}P`
                          : formatKRW(formData.amount)
                        : formData.type === 'point'
                        ? 'P'
                        : '원'}
                    </span>
                  </div>
                </div>

                {/* Merchant / Store */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    {merchantField.label}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={merchantField.placeholder}
                    value={formData.merchant}
                    onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
                    className="w-full text-xs sm:text-sm px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-zinc-900 outline-none transition"
                  />
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      일자
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full text-xs px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      시간
                    </label>
                    <input
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      className="w-full text-xs px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white outline-none"
                    />
                  </div>
                </div>

                {/* Category Chips & Payment Method (Hidden when type === 'point') */}
                {formData.type !== 'point' ? (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1">
                        카테고리
                      </label>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-zinc-50 rounded-xl border border-zinc-100">
                        {CATEGORIES.filter((cat) => cat.name !== '포인트').map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                category: cat.name,
                                type:
                                  cat.name === '저축/투자'
                                    ? 'saving'
                                    : formData.type === 'saving'
                                    ? 'expense'
                                    : formData.type
                              })
                            }
                            className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition whitespace-nowrap ${
                              formData.category === cat.name
                                ? 'bg-zinc-900 text-white shadow-xs font-bold'
                                : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200/50'
                            }`}
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          결제 수단
                        </label>
                        <select
                          value={formData.payment_method}
                          onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                          className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none"
                        >
                          {PAYMENT_METHODS.map((method) => (
                            <option key={method} value={method}>
                              {method}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          메모 / 품목
                        </label>
                        <input
                          type="text"
                          placeholder="품목명이나 간단한 메모"
                          value={formData.memo}
                          onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                          className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      메모 (선택)
                    </label>
                    <input
                      type="text"
                      placeholder="추가 메모가 있다면 입력하세요"
                      value={formData.memo}
                      onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                      className="w-full text-xs px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white outline-none"
                    />
                  </div>
                )}

                {/* Detected Point Bonus Sync Toggle */}
                {formData.type !== 'point' && detectedEarnedPoint > 0 && (
                  <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-2xl flex items-center justify-between animate-fade-in">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-zinc-900">
                      <input
                        type="checkbox"
                        checked={recordPointSync}
                        onChange={(e) => setRecordPointSync(e.target.checked)}
                        className="w-4 h-4 rounded text-zinc-900 accent-zinc-900 cursor-pointer"
                      />
                      <span>네이버페이 포인트 +{formatKRW(detectedEarnedPoint).replace('원', '')}P 적립도 함께 기록</span>
                    </label>
                    <span className="text-[10px] font-semibold text-zinc-600 bg-zinc-200/70 px-2 py-0.5 rounded-full">
                      자동 감지
                    </span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isAnalyzing}
                  className="w-full mt-2 py-2 px-4 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-[0.99] flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>가계부에 저장하기</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
