import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Camera,
  Sparkles,
  Check,
  AlertCircle,
  Key,
  ShoppingBag,
  RotateCcw,
  Star
} from 'lucide-react';
import { formatKRW } from '../constants';

const WISHLIST_CATEGORIES = [
  '전자기기',
  '패션/잡화',
  '생활용품',
  '취미/문화',
  '도서/강의',
  '쇼핑',
  '기타'
];

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function analyzeWishlistWithGemini(base64Data, mimeType, apiKey) {
  const cleanKey = (apiKey || '').trim();
  const prompt = `당신은 쇼핑몰 상품 캡처본 및 위시리스트 분석 전문 AI입니다.
이미지에서 사고 싶은 상품의 정보를 추출하여 마크다운 코드블록 없이 반드시 아래 순수 JSON 형식으로만 응답하세요:
{
  "title": "깔끔하게 정리된 브랜드 + 상품명",
  "price": 최종할인가또는판매가(숫자만, 원 단위),
  "category": "전자기기|패션/잡화|생활용품|취미/문화|도서/강의|쇼핑|기타 중 택1",
  "priority": 4,
  "link": "이미지 상단/하단 주소창에 URL이 보이면 추출, 없으면 빈 문자열",
  "memo": "쇼핑몰 이름(쿠팡, 무신사, 네이버 등), 할인 정보, 옵션/특징 등 한 줄 요약"
}`;

  // 후보군: TTS, Live, Nano Banana(이미지 생성) 모델을 제외한 멀티모달 Flash / Flash-Lite 모델들
  const models = [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-flash-latest'
  ];

  // 제외할 특수 목적 모델 키워드 (TTS, Live, Nano Banana 이미지 생성 등)
  const isExcludedModel = (name = '') => {
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
      lower.includes('aqa')
    );
  };

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
          temperature: 0.1,
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
      return await callModel(model);
    } catch (err) {
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

  // Fallback: query available models for this API key dynamically (excluding TTS, Live, Nano Banana)
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`);
    if (listRes.ok) {
      const listData = await listRes.json();
      const dynamicCandidates = (listData.models || []).filter(
        m =>
          (m.supportedGenerationMethods || []).includes('generateContent') &&
          m.name.includes('gemini') &&
          !isExcludedModel(m.name) &&
          !isExcludedModel(m.displayName)
      );
      for (const candidate of dynamicCandidates) {
        try {
          return await callModel(candidate.name);
        } catch (_) {}
      }
    }
  } catch (_) {}

  throw lastError || new Error('위시리스트 상품 AI 분석에 실패했습니다.');
}

export default function WishlistAiScannerModal({
  isOpen,
  onClose,
  onAddWishlistItem,
  remainingBudget = 0,
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

  const [formData, setFormData] = useState({
    title: '',
    price: '',
    category: '쇼핑',
    priority: 4,
    link: '',
    memo: ''
  });

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    if (initialFile && isOpen) {
      processFile(initialFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setPreviewUrl('');
      setIsAnalyzing(false);
      setErrorMsg('');
      setRequiresKey(false);
      setFormData({
        title: '',
        price: '',
        category: '쇼핑',
        priority: 4,
        link: '',
        memo: ''
      });
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
      const apiKey = localStorage.getItem('budget_gemini_key') || '';
      if (!apiKey) {
        // Fallback: try local server if available
        let serverExtracted = null;
        try {
          const form = new FormData();
          form.append('image', selectedFile);
          const res = await fetch('/api/ai/recognize', {
            method: 'POST',
            body: form
          });
          if (res.ok) {
            const d = await res.json();
            if (d.extracted && !d.requiresKey) {
              serverExtracted = {
                title: d.extracted.merchant || '',
                price: d.extracted.amount || '',
                category: WISHLIST_CATEGORIES.includes(d.extracted.category) ? d.extracted.category : '쇼핑',
                priority: 4,
                link: '',
                memo: d.extracted.memo || ''
              };
            }
          }
        } catch (_) {}

        if (!serverExtracted) {
          setRequiresKey(true);
          setIsAnalyzing(false);
          return;
        }

        setFormData({
          title: serverExtracted.title,
          price: serverExtracted.price ? String(serverExtracted.price) : '',
          category: serverExtracted.category,
          priority: 4,
          link: '',
          memo: serverExtracted.memo
        });
        setIsAnalyzing(false);
        return;
      }

      const base64 = await fileToBase64(selectedFile);
      const extracted = await analyzeWishlistWithGemini(base64, selectedFile.type, apiKey);

      setFormData({
        title: extracted.title || '',
        price: extracted.price ? String(extracted.price) : '',
        category: WISHLIST_CATEGORIES.includes(extracted.category) ? extracted.category : '쇼핑',
        priority: Number(extracted.priority) || 4,
        link: extracted.link || '',
        memo: extracted.memo || ''
      });
    } catch (err) {
      setErrorMsg(err.message || '상품 캡처 이미지 분석에 실패했습니다.');
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
      if (onSaveApiKey) {
        await onSaveApiKey(inputKey.trim());
      } else {
        localStorage.setItem('budget_gemini_key', inputKey.trim());
      }
      setRequiresKey(false);
      if (file) {
        processFile(file);
      }
    } catch (_) {
      setErrorMsg('API 키 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.price) {
      setErrorMsg('상품명과 예상 가격을 입력해 주세요.');
      return;
    }

    onAddWishlistItem({
      id: Date.now(),
      title: formData.title.trim(),
      price: Number(formData.price),
      category: formData.category || '쇼핑',
      priority: Number(formData.priority) || 4,
      link: formData.link.trim(),
      memo: formData.memo.trim(),
      status: 'pending',
      createdAt: new Date().toISOString().slice(0, 10)
    });
    onClose();
  };

  const numericPrice = Number(formData.price) || 0;
  const isAffordable = numericPrice > 0 && remainingBudget >= numericPrice;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden my-auto max-h-[92vh] flex flex-col border border-zinc-200">
        {/* Modal Header — Distinct Wishlist AI Scanner Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200 flex items-center justify-between bg-zinc-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/15 text-white flex items-center justify-center">
              <ShoppingBag className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm sm:text-base font-bold text-white">
                  위시리스트 AI 캡처 등록
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-zinc-900">
                  쇼핑·위시 전용
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                쇼핑몰(쿠팡·무신사·네이버 등) 상품 화면을 캡처해 올리면 상품명과 가격을 자동 입력합니다
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Missing API Key Banner */}
          {(!hasApiKey && !localStorage.getItem('budget_gemini_key') || requiresKey) && (
            <div className="p-3.5 bg-zinc-50 rounded-2xl border border-zinc-300 text-zinc-900 text-xs">
              <div className="flex items-start gap-2.5">
                <Key className="w-4 h-4 text-zinc-700 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="font-bold text-zinc-900">
                    💡 무료 Gemini API 키를 등록하면 쇼핑몰 캡처 AI 인식이 즉시 작동합니다!
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <input
                      type="password"
                      placeholder="AIzaSy... 형태의 Gemini API 키 붙여넣기"
                      value={inputKey}
                      onChange={(e) => setInputKey(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-white rounded-xl border border-zinc-300 text-xs outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={handleSaveApiKeyInline}
                        disabled={isSavingKey || !inputKey.trim()}
                        className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition"
                      >
                        {isSavingKey ? '저장 중...' : '키 저장 & 분석'}
                      </button>
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 bg-white border border-zinc-300 text-zinc-700 text-xs rounded-xl hover:bg-zinc-100 flex items-center gap-1 transition"
                      >
                        무료 키 발급 ↗
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Left Column: Product Screenshot Dropzone / Preview */}
            <div className="md:col-span-5 flex flex-col">
              {!previewUrl ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 min-h-60 border-2 border-dashed border-zinc-300 hover:border-zinc-900 bg-zinc-50/70 hover:bg-zinc-100/50 rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-zinc-800">
                    사고 싶은 상품 캡처본 업로드
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                    클릭하여 이미지 선택, 드래그 앤 드롭,<br />
                    또는 화면 캡처 후 <strong className="text-zinc-800">Ctrl+V</strong> 붙여넣기
                  </p>

                  <div className="mt-4 flex flex-wrap justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>캡처 이미지 선택</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="px-3 py-1.5 bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>카메라 촬영</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-900 flex items-center justify-center min-h-60 max-h-80">
                  <img
                    src={previewUrl}
                    alt="Wishlist Product Preview"
                    className="max-h-80 w-auto object-contain"
                  />

                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-zinc-900/75 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4 text-center">
                      <Sparkles className="w-8 h-8 text-white animate-spin mb-2" />
                      <p className="text-xs sm:text-sm font-bold">AI가 상품명과 가격을 읽고 있습니다...</p>
                      <p className="text-[11px] text-zinc-300 mt-1">잠시만 기다려 주세요</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setPreviewUrl('');
                    }}
                    className="absolute top-2.5 right-2.5 px-2.5 py-1 bg-zinc-900/80 hover:bg-zinc-900 text-white text-[11px] font-semibold rounded-lg flex items-center gap-1 backdrop-blur-xs transition"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>다시 선택</span>
                  </button>
                </div>
              )}

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

            {/* Right Column: Extracted Wishlist Item Form */}
            <form onSubmit={handleSubmit} className="md:col-span-7 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-zinc-800 mb-1">
                  상품명 *
                </label>
                <input
                  type="text"
                  required
                  placeholder="AI가 캡처에서 상품명을 자동 입력합니다"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full text-xs sm:text-sm font-semibold px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-zinc-900 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-800 mb-1">
                  예상 가격 (원) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    placeholder="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full text-lg font-extrabold px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-zinc-900 outline-none transition"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">
                    {formData.price ? formatKRW(formData.price) : '원'}
                  </span>
                </div>

                {/* Live Budget Affordability Check */}
                {numericPrice > 0 && (
                  <div className={`mt-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium flex items-center justify-between ${
                    isAffordable
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}>
                    <span>
                      {isAffordable
                        ? `🟢 이번 달 남은 예산(${formatKRW(remainingBudget)}) 내 구매 가능!`
                        : `⚠️ 이번 달 남은 예산보다 ${formatKRW(numericPrice - Math.max(0, remainingBudget))} 초과`}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-zinc-800 mb-1">
                    카테고리
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full text-xs px-2.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:bg-white"
                  >
                    {WISHLIST_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-800 mb-1">
                    희망 우선순위
                  </label>
                  <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFormData({ ...formData, priority: star })}
                        className="p-0.5 transition hover:scale-110"
                        title={`${star}점`}
                      >
                        <Star
                          className={`w-4 h-4 ${
                            star <= (Number(formData.priority) || 4)
                              ? 'fill-zinc-900 text-zinc-900'
                              : 'text-zinc-300'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="ml-auto text-[11px] font-bold text-zinc-600">
                      {formData.priority}점
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-800 mb-1">
                  쇼핑몰 / 옵션 메모
                </label>
                <input
                  type="text"
                  placeholder="예: 무신사 20% 쿠폰 적용가, 블랙 M사이즈"
                  value={formData.memo}
                  onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-800 mb-1">
                  상품 링크 URL (선택)
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={formData.link}
                  onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white outline-none"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold text-xs rounded-xl transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isAnalyzing}
                  className="flex-1 py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>위시리스트에 담기</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
