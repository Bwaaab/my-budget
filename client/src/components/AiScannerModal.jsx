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
  RotateCcw
} from 'lucide-react';
import { CATEGORIES, PAYMENT_METHODS, formatKRW } from '../constants';

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
  const prompt = `한국 가계부 결제/영수증/투자 캡처 이미지에서 아래 JSON만 즉시 출력하세요 (주식/ETF/코인 매수, 적금/예금/청약/ISA/연금/증권계좌 납입·이체는 반드시 type:"saving", category:"저축/투자"로 분류):
{"type":"expense|saving|income","amount":숫자,"merchant":"상호명 또는 종목/계좌명","date":"YYYY-MM-DD","time":"HH:mm","category":"식비|카페/간식|마트/생필품|교통|문화/여가|쇼핑|의료/건강|주거/통신|저축/투자|급여|기타","payment_method":"카드/이체","memo":"간단요약"}`;

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
          maxOutputTokens: 256,
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
  hasApiKey,
  onSaveApiKey,
  initialFile
}) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [requiresKey, setRequiresKey] = useState(false);
  const [inputKey, setInputKey] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);

  // Extracted/Edited form state
  const [formData, setFormData] = useState({
    type: 'expense',
    amount: '',
    merchant: '',
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 5),
    category: '식비',
    payment_method: '신용카드',
    memo: '',
    items: [],
    image_path: ''
  });

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // If initial file is passed (e.g. from global paste)
  useEffect(() => {
    if (initialFile && isOpen) {
      processFile(initialFile);
    }
  }, [initialFile, isOpen]);

  // Clean up preview url when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setPreviewUrl('');
      setIsAnalyzing(false);
      setErrorMsg('');
      setRequiresKey(false);
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
        const isSaving =
          data.extracted.type === 'saving' ||
          data.extracted.category === '저축/투자' ||
          data.extracted.category === '저축' ||
          data.extracted.category === '투자';
        setFormData({
          type: isSaving ? 'saving' : data.extracted.type || 'expense',
          amount: data.extracted.amount ? String(data.extracted.amount) : '',
          merchant: data.extracted.merchant || '',
          date: data.extracted.date || new Date().toISOString().slice(0, 10),
          time: data.extracted.time || new Date().toTimeString().slice(0, 5),
          category: isSaving ? '저축/투자' : data.extracted.category || '기타',
          payment_method: data.extracted.payment_method || (isSaving ? '계좌이체' : '신용카드'),
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
    if (!inputKey.trim()) return;
    setIsSavingKey(true);
    try {
      await onSaveApiKey(inputKey.trim());
      setRequiresKey(false);
      // Re-analyze with newly configured key
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
    if (!formData.amount || !formData.merchant) {
      setErrorMsg('금액과 상호(사용처)를 입력해 주세요.');
      return;
    }

    onSaveTransaction({
      ...formData,
      amount: Number(formData.amount)
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
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
          {(!hasApiKey || requiresKey) && (
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
                    <input
                      type="password"
                      placeholder="AI Studio에서 발급받은 Gemini API 키 붙여넣기"
                      value={inputKey}
                      onChange={(e) => setInputKey(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-white rounded-xl border border-amber-300 text-xs outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={handleSaveApiKeyInline}
                        disabled={isSavingKey || !inputKey.trim()}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-medium text-xs rounded-xl shadow-xs transition"
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
                </div>
              </div>
            </div>
          )}

          {/* Upload Dropzone & Actions */}
          {!previewUrl ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-indigo-200 rounded-3xl p-8 text-center hover:border-indigo-400 hover:bg-indigo-50/20 transition-all cursor-pointer flex flex-col items-center justify-center space-y-3"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Upload className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-sm sm:text-base font-bold text-slate-800">
                  캡처본이나 영수증 이미지를 여기에 올려주세요
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  또는 화면 어디서든 <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-semibold border">Ctrl+V</kbd> 로 붙여넣으세요
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  <Upload className="w-4 h-4" />
                  파일 선택
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center gap-1.5"
                >
                  <Camera className="w-4 h-4 text-indigo-600" />
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
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-indigo-950/40 backdrop-blur-xs">
                    <div className="w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent absolute animate-bounce" />
                    <div className="bg-slate-900/80 text-white px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-2 shadow-lg border border-slate-700">
                      <Sparkles className="w-4 h-4 text-yellow-300 animate-spin" />
                      <span>AI가 정보를 정밀 분석하고 있습니다...</span>
                    </div>
                  </div>
                )}

                {/* Retake / Change Image Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-2 right-2 bg-slate-900/80 hover:bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 border border-slate-700 shadow transition"
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
                <div className="flex bg-slate-100 rounded-xl p-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        type: 'expense',
                        category: formData.category === '저축/투자' ? '식비' : formData.category
                      })
                    }
                    className={`flex-1 py-1.5 rounded-lg transition whitespace-nowrap ${
                      formData.type === 'expense'
                        ? 'bg-rose-500 text-white shadow-xs'
                        : 'text-slate-600'
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
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600'
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
                        category: formData.category === '저축/투자' ? '급여' : formData.category
                      })
                    }
                    className={`flex-1 py-1.5 rounded-lg transition whitespace-nowrap ${
                      formData.type === 'income'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    수입
                  </button>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    금액 (원)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      placeholder="0"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full text-lg sm:text-xl font-extrabold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                      {formData.amount ? formatKRW(formData.amount) : '원'}
                    </span>
                  </div>
                </div>

                {/* Merchant / Store */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    상호 / 사용처
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="예: 스타벅스 강남점, 배달의민족, GS25"
                    value={formData.merchant}
                    onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
                    className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                  />
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      결제 일자
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      시간
                    </label>
                    <input
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none"
                    />
                  </div>
                </div>

                {/* Category Chips */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    카테고리
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-100">
                    {CATEGORIES.map((cat) => (
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
                            ? 'bg-indigo-600 text-white shadow-xs font-bold'
                            : 'bg-white text-slate-600 hover:bg-slate-200/60 border border-slate-200/50'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment Method & Memo */}
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
