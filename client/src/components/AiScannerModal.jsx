import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Camera,
  Sparkles,
  Check,
  AlertCircle,
  Key,
  RotateCcw,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Layers,
  ChevronDown
} from 'lucide-react';
import {
  CATEGORIES,
  PAYMENT_METHODS,
  formatKRW,
  getNecessity,
  cleanNumber,
  normalizeDateYMD,
  normalizeTimeHM,
  todayYMD,
  nowHM,
  getMerchantFieldInfo
} from '../constants';

const createEmptyAiFormData = () => ({
  tempId: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  checked: true,
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

// Normalize raw AI object into our form item structure
function normalizeExtractedToFormItem(raw, imagePath = '', idx = 0) {
  const isPoint =
    raw.type === 'point' ||
    raw.type === 'point_earn' ||
    raw.type === 'point_use' ||
    raw.category === '포인트' ||
    raw.payment_method === '네이버페이(포인트)';

  const isSaving =
    !isPoint &&
    (raw.type === 'saving' ||
      raw.category === '저축/투자' ||
      raw.category === '저축' ||
      raw.category === '투자');

  const cleanAmt = cleanNumber(raw.amount) || (isPoint ? cleanNumber(raw.earned_point) : 0);
  const cleanDate = normalizeDateYMD(raw.date);
  const cleanTime = normalizeTimeHM(raw.time) || nowHM();

  return {
    tempId: `item_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
    checked: true,
    type: isPoint ? 'point' : isSaving ? 'saving' : raw.type === 'income' ? 'income' : 'expense',
    pointMode: raw.type === 'point_use' ? 'use' : 'earn',
    necessity: isSaving ? 'need' : raw.necessity || getNecessity(raw),
    amount: cleanAmt > 0 ? String(cleanAmt) : '',
    merchant: raw.merchant || (isPoint ? '네이버페이 포인트 적립' : ''),
    date: cleanDate,
    time: cleanTime,
    category: isPoint ? '포인트' : isSaving ? '저축/투자' : raw.category || '기타',
    payment_method: isPoint ? '네이버페이(포인트)' : raw.payment_method || (isSaving ? '계좌이체' : '신용카드'),
    memo: raw.memo || '',
    items: raw.items || [],
    image_path: imagePath,
    earned_point: isPoint ? 0 : cleanNumber(raw.earned_point)
  };
}

// Compress & resize image on client (max 1152px so long vertical transaction list screenshots stay sharp)
function compressImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX_DIM = 1152;
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
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      resolve({
        base64: dataUrl.split(',')[1],
        mimeType: 'image/jpeg'
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = () =>
        resolve({ base64: reader.result.split(',')[1], mimeType: file.type || 'image/jpeg' });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    };
    img.src = objectUrl;
  });
}

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
          (m) =>
            (m.supportedGenerationMethods || []).includes('generateContent') &&
            m.name.includes('gemini') &&
            !isExcludedModel(m.name) &&
            !isExcludedModel(m.displayName)
        )
        .map((m) => m.name.replace(/^models\//, ''));

      if (validServerModels.length > 0) {
        const liteModels = validServerModels.filter(
          (m) => m.includes('flash-lite') || m.includes('lite')
        );
        const flashModels = validServerModels.filter(
          (m) => m.includes('flash') && !liteModels.includes(m)
        );
        const ranked = [
          ...preferredOrder.filter((p) => validServerModels.includes(p)),
          ...liteModels.filter((m) => !preferredOrder.includes(m)),
          ...flashModels.filter((m) => !preferredOrder.includes(m))
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
  const prompt = `한국 가계부 결제/영수증/이체/투자/포인트 캡처 이미지에서 거래 내역들을 추출해 JSON으로 반환하세요.

[핵심 판별 규칙: 단건 영수증 vs 다중 내역 리스트]
1. **단일 결제 영수증 / 단건 결제·송금 상세 화면** (예: 마트/식당 영수증 1장, 배달 주문 상세 1건):
   - 영수증 내부에 세부 품목(사과, 우유 등)이 여러 개 적혀 있더라도 실제 결제는 1건이므로 **총 결제 금액 1건만** "transactions" 배열에 담으세요.
   - 단, 화면에 "네이버페이 포인트 N원 적립" 같은 혜택 문구가 함께 보이면 해당 거래의 earned_point에 적립 포인트 숫자를 넣으세요.
2. **다중 거래 내역 리스트 화면** (예: 은행/토스/카카오페이 입출금·결제 내역 목록, 카드사 승인내역 리스트, 네이버페이 포인트 적립/사용 내역 목록, 결제 알림 문자 목록 캡처):
   - 화면에 여러 건의 독립된 거래 내역이 위에서 아래로 나열되어 있다면, **보이는 모든 거래 줄을 위에서부터 빠짐없이 각각 별도의 객체로 분리**하여 "transactions" 배열에 전부 담으세요!
   - 거래 후 잔액 표시나 '수수료 0원'은 거래 금액이 아니므로 제외하고, 각 줄의 실제 거래/결제/입금/적립 금액만 추출하세요.

[각 항목(transaction) 필드 규칙]
- type:
  - 일반 소비 지출은 "expense"
  - 주식/ETF/적금/예금/ISA/연금/청약 납입·이체는 "saving"
  - 급여/용돈/환급/입금은 "income"
  - 네이버페이 등 포인트 적립 내역은 "point_earn"
  - 네이버페이 등 포인트 사용/차감 내역은 "point_use"
- necessity: 지출("expense")일 때 필수 생활비(식사, 마트, 교통, 공과금, 병원)는 "need", 선택적/아낄 수 있었던 소비(카페/디저트, 배달야식, 쇼핑, 택시, 여가)는 "want"
- amount: 쉼표 없는 양의 정수 숫자 (예: 15000, 4800, 150)
- merchant: 상호명, 가맹점명, 수취인, 투자종목명, 또는 포인트 적립/사용 사유 (예: "스타벅스", "배달의민족", "토스증권 S&P500", "네이버페이 구매 적립")
- date: 거래 일자 "YYYY-MM-DD" 형식 (연도가 없으면 현재 연도 ${currentYear} 적용, 같은 날짜 그룹 아래 묶인 내역들은 해당 그룹 날짜를 동일하게 적용)
- time: 거래 시각 "HH:mm" 형식 (없으면 "")
- category: "식비"|"카페/간식"|"마트/생필품"|"교통"|"문화/여가"|"쇼핑"|"의료/건강"|"주거/통신"|"저축/투자"|"급여"|"포인트"|"기타" 중 택1
- payment_method: "신용카드"|"체크카드"|"네이버페이"|"네이버페이(포인트)"|"카카오페이"|"토스페이"|"계좌이체"|"현금" 등
- memo: 핵심 품목 또는 간단 요약
- earned_point: 단건 영수증 하단에 부가적인 포인트 적립 혜택 문구가 있을 때만 적립 포인트 숫자 (없거나 이미 type이 "point_earn"이면 0)

반드시 아래 JSON 형식만 반환하세요:
{"transactions":[{"type":"expense","necessity":"need","amount":15000,"merchant":"상호명","date":"${currentYear}-MM-DD","time":"HH:mm","category":"식비","payment_method":"신용카드","memo":"품목","earned_point":0}]}`;

  const models = await getOrderedAvailableModels(cleanKey);

  const callModel = async (modelName) => {
    const cleanModel = modelName.replace(/^models\//, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${encodeURIComponent(cleanKey)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: base64Data } }
            ]
          }
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 4096,
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
    const cleaned = txt
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
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
  onSaveMultipleTransactions,
  hasApiKey,
  onSaveApiKey,
  initialFile
}) {
  const [files, setFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [activePreviewIdx, setActivePreviewIdx] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingProgress, setAnalyzingProgress] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [requiresKey, setRequiresKey] = useState(false);
  const [inputKey, setInputKey] = useState(() => localStorage.getItem('budget_gemini_key') || '');
  const [showInputKey, setShowInputKey] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [savedKeySuccess, setSavedKeySuccess] = useState(false);

  // Point bonus detection (for single-item mode)
  const [detectedEarnedPoint, setDetectedEarnedPoint] = useState(0);
  const [recordPointSync, setRecordPointSync] = useState(true);

  // Single-item form state (used when batchItems.length <= 1)
  const [formData, setFormData] = useState(createEmptyAiFormData);
  // Multi-item batch state (used when 2+ items are extracted or manually added)
  const [batchItems, setBatchItems] = useState([]);

  const merchantField = getMerchantFieldInfo(formData.type, formData.pointMode);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef(null);
  const appendFileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // If initial file(s) passed (e.g. from global paste or multi-file drop)
  useEffect(() => {
    if (initialFile && isOpen) {
      const incoming = Array.isArray(initialFile) ? initialFile : [initialFile];
      processFiles(incoming, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile, isOpen]);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFiles([]);
      setPreviewUrls([]);
      setActivePreviewIdx(0);
      setIsAnalyzing(false);
      setAnalyzingProgress('');
      setErrorMsg('');
      setRequiresKey(false);
      setIsSubmitting(false);
      setDetectedEarnedPoint(0);
      setRecordPointSync(true);
      setFormData(createEmptyAiFormData());
      setBatchItems([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isMultiMode = batchItems.length >= 2;
  const previewUrl = previewUrls[activePreviewIdx] || previewUrls[0] || '';

  const analyzeSingleFile = async (selectedFile, objectUrl) => {
    const apiKey = (localStorage.getItem('budget_gemini_key') || '').trim();
    let parsedResult = null;
    let savedImagePath = objectUrl;

    if (apiKey) {
      const { base64, mimeType } = await compressImageToBase64(selectedFile);
      parsedResult = await analyzeDirectWithGemini(base64, mimeType, apiKey);
    } else if (!window.location.hostname.includes('github.io')) {
      try {
        const form = new FormData();
        form.append('image', selectedFile);
        const res = await fetch('/api/ai/recognize', {
          method: 'POST',
          body: form
        });
        if (res.ok) {
          const serverData = await res.json();
          if (serverData.requiresKey) {
            return { requiresKey: true, items: [] };
          }
          savedImagePath = serverData.savedImagePath || objectUrl;
          parsedResult = serverData.transactions
            ? { transactions: serverData.transactions }
            : serverData.extracted;
        }
      } catch (_) {}
    } else {
      return { requiresKey: true, items: [] };
    }

    if (!parsedResult) {
      return { requiresKey: true, items: [] };
    }

    const rawList = Array.isArray(parsedResult.transactions)
      ? parsedResult.transactions
      : Array.isArray(parsedResult)
      ? parsedResult
      : [parsedResult];

    const normalized = rawList
      .map((item, idx) => normalizeExtractedToFormItem(item, savedImagePath, idx))
      .filter((item) => cleanNumber(item.amount) > 0 || rawList.length === 1);

    // If a single receipt in a multi-item list also had earned_point > 0, expand it as a point row when in multi-mode
    const expanded = [];
    for (const item of normalized) {
      expanded.push(item);
      if (normalized.length >= 2 && item.earned_point > 0 && item.type !== 'point') {
        expanded.push({
          ...createEmptyAiFormData(),
          tempId: `item_${Date.now()}_pt_${Math.random().toString(36).slice(2, 6)}`,
          checked: true,
          type: 'point',
          pointMode: 'earn',
          amount: String(item.earned_point),
          merchant: `${item.merchant || '결제'} 포인트 적립`,
          date: item.date,
          time: item.time,
          category: '포인트',
          payment_method: '네이버페이(포인트)',
          memo: 'AI 캡처 적립 혜택 자동 인식',
          image_path: savedImagePath
        });
      }
    }

    return { requiresKey: false, items: expanded };
  };

  const processFiles = async (fileList, append = false) => {
    const validFiles = Array.from(fileList || []).filter((f) => f && f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      setErrorMsg('이미지 파일(PNG, JPG, WEBP 등)을 선택해 주세요.');
      return;
    }

    const newUrls = validFiles.map((f) => URL.createObjectURL(f));
    const nextFiles = append ? [...files, ...validFiles] : validFiles;
    const nextUrls = append ? [...previewUrls, ...newUrls] : newUrls;

    setFiles(nextFiles);
    setPreviewUrls(nextUrls);
    setActivePreviewIdx(append ? previewUrls.length : 0);
    setErrorMsg('');
    setIsAnalyzing(true);
    if (!append) {
      setFormData(createEmptyAiFormData());
      setBatchItems([]);
    }

    try {
      let collected = append ? [...batchItems] : [];
      // If we were in single mode before appending and had a valid formData, keep it in collected
      if (append && collected.length === 0 && (cleanNumber(formData.amount) > 0 || formData.merchant)) {
        collected.push({ ...formData, checked: true });
      }

      for (let i = 0; i < validFiles.length; i++) {
        if (validFiles.length > 1) {
          setAnalyzingProgress(`(${i + 1}/${validFiles.length}장 분석 중...)`);
        } else {
          setAnalyzingProgress('');
        }
        const { requiresKey: needKey, items } = await analyzeSingleFile(validFiles[i], newUrls[i]);
        if (needKey) {
          setRequiresKey(true);
          setIsAnalyzing(false);
          return;
        }
        collected = [...collected, ...items];
      }

      if (collected.length === 1) {
        const only = collected[0];
        const bonus = cleanNumber(only.earned_point);
        setDetectedEarnedPoint(bonus);
        setRecordPointSync(bonus > 0);
        setFormData(only);
        setBatchItems([only]);
      } else if (collected.length >= 2) {
        // If the first item had an unexpanded earned_point from earlier single mode, expand it now
        const finalBatch = [];
        for (const item of collected) {
          finalBatch.push({ ...item, checked: item.checked !== false });
          if (item.earned_point > 0 && item.type !== 'point' && collected.length === 1) {
            finalBatch.push({
              ...createEmptyAiFormData(),
              checked: true,
              type: 'point',
              pointMode: 'earn',
              amount: String(item.earned_point),
              merchant: `${item.merchant || '결제'} 포인트 적립`,
              date: item.date,
              time: item.time,
              category: '포인트',
              payment_method: '네이버페이(포인트)',
              memo: 'AI 캡처 적립 혜택 자동 인식'
            });
          }
        }
        setBatchItems(finalBatch);
        setFormData(finalBatch[0]);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || '캡처 인식에 실패했습니다.');
    } finally {
      setIsAnalyzing(false);
      setAnalyzingProgress('');
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files, false);
      e.target.value = '';
    }
  };

  const handleAppendFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files, true);
      e.target.value = '';
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files, false);
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
      if (files.length > 0) {
        processFiles(files, false);
      }
    } catch (_) {
      setErrorMsg('API 키 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingKey(false);
    }
  };

  // Switch from 1-item mode to multi-item mode by adding a blank row
  const handleAddManualRow = () => {
    const newRow = {
      ...createEmptyAiFormData(),
      date: formData.date || todayYMD(),
      image_path: previewUrl
    };
    if (batchItems.length <= 1) {
      setBatchItems([{ ...formData, checked: true }, newRow]);
    } else {
      setBatchItems([...batchItems, newRow]);
    }
  };

  const handleUpdateBatchItem = (tempId, patch) => {
    setBatchItems((prev) =>
      prev.map((item) => {
        if (item.tempId !== tempId) return item;
        const updated = { ...item, ...patch };
        if (patch.type === 'saving') {
          updated.category = '저축/투자';
          updated.payment_method = '계좌이체';
        } else if (patch.type === 'point') {
          updated.category = '포인트';
          updated.payment_method = '네이버페이(포인트)';
        } else if (patch.type === 'income' && ['저축/투자', '포인트'].includes(updated.category)) {
          updated.category = '급여';
        } else if (patch.type === 'expense' && ['저축/투자', '포인트', '급여'].includes(updated.category)) {
          updated.category = '식비';
        }
        return updated;
      })
    );
  };

  const handleRemoveBatchItem = (tempId) => {
    setBatchItems((prev) => {
      const next = prev.filter((item) => item.tempId !== tempId);
      if (next.length === 1) {
        setFormData(next[0]);
      }
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    // 1. Multi-Item Batch Submit
    if (isMultiMode) {
      const selected = batchItems.filter((item) => item.checked !== false);
      if (selected.length === 0) {
        setErrorMsg('저장할 항목을 최소 1개 이상 체크해 주세요.');
        return;
      }

      const validPayloads = [];
      for (const item of selected) {
        const cleanAmt = cleanNumber(item.amount);
        const cleanMerchant = (item.merchant || '').trim();
        if (!cleanAmt || !cleanMerchant) {
          setErrorMsg('선택된 모든 항목의 금액(0원 초과)과 상호/내용을 입력해 주세요.');
          return;
        }
        const savedDate = normalizeDateYMD(item.date) || todayYMD();
        const savedTime = normalizeTimeHM(item.time) || nowHM();

        if (item.type === 'point') {
          const isUse = item.pointMode === 'use';
          validPayloads.push({
            ...item,
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
          validPayloads.push({
            ...item,
            amount: cleanAmt,
            merchant: cleanMerchant,
            date: savedDate,
            time: savedTime
          });
        }
      }

      setIsSubmitting(true);
      try {
        if (onSaveMultipleTransactions) {
          onSaveMultipleTransactions(validPayloads);
        } else {
          validPayloads.forEach((p) => onSaveTransaction(p));
        }
        onClose();
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // 2. Single-Item Submit
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
      } else if (recordPointSync && detectedEarnedPoint > 0 && onSaveMultipleTransactions) {
        onSaveMultipleTransactions([
          {
            ...formData,
            amount: cleanAmt,
            merchant: cleanMerchant,
            date: savedDate,
            time: savedTime
          },
          {
            type: 'income',
            category: '포인트',
            payment_method: '네이버페이(포인트)',
            amount: detectedEarnedPoint,
            merchant: `${cleanMerchant} 포인트 적립`,
            date: savedDate,
            time: savedTime,
            memo: 'AI 캡처 적립 혜택 자동 인식',
            image_path: formData.image_path
          }
        ]);
      } else {
        onSaveTransaction({
          ...formData,
          amount: cleanAmt,
          merchant: cleanMerchant,
          date: savedDate,
          time: savedTime
        });
      }

      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedBatchCount = batchItems.filter((i) => i.checked !== false).length;
  const allBatchChecked = batchItems.length > 0 && selectedBatchCount === batchItems.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-zinc-900/60 animate-fade-in overflow-y-auto">
      <div
        className={`bg-white rounded-3xl shadow-2xl w-full ${
          isMultiMode ? 'max-w-4xl' : 'max-w-3xl'
        } overflow-hidden my-auto max-h-[92vh] flex flex-col border border-zinc-100 transition-all`}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-zinc-900">
                AI 캡처 인식
              </h2>
              {isMultiMode && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-900 text-white flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  <span>다중 인식 {batchItems.length}건</span>
                </span>
              )}
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
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
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
                    영수증 단건은 물론, 은행/카드/토스/네이버페이 거래내역 리스트 캡처도 한 번에 여러 건씩 자동 분리 인식합니다.
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
                      <span>API 키가 안전하게 저장되었습니다! 이제 캡처 이미지를 올려주세요.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Hidden file inputs (accessible in both upload and preview states) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <input
            ref={appendFileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleAppendFileChange}
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
                  영수증이나 거래내역 리스트 캡처본을 올려주세요
                </h4>
                <p className="text-xs text-zinc-500 mt-1">
                  한 장에 여러 내역이 찍힌 캡처나 여러 장의 사진도 한 번에 분리 인식합니다 ·{' '}
                  <kbd className="px-1.5 py-0.5 bg-zinc-100 rounded text-zinc-600 font-semibold border border-zinc-200">
                    Ctrl+V
                  </kbd>{' '}
                  붙여넣기 지원
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
                  파일 선택 (다중 가능)
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
            </div>
          ) : (
            /* Split View: Image Preview + Form (Single or Multi-Item Batch) */
            <div className={`grid grid-cols-1 ${isMultiMode ? 'lg:grid-cols-12' : 'md:grid-cols-2'} gap-4`}>
              {/* Left Column: Image Preview & Multi-Image Thumbnails */}
              <div className={`${isMultiMode ? 'lg:col-span-4' : ''} flex flex-col gap-2`}>
                <div className="bg-zinc-900 rounded-2xl overflow-hidden relative min-h-[200px] max-h-[360px] flex items-center justify-center border border-zinc-200">
                  <img
                    src={previewUrl}
                    alt="Receipt Preview"
                    className={`max-h-[350px] max-w-full object-contain ${
                      isAnalyzing ? 'opacity-70 blur-[1px]' : ''
                    }`}
                  />

                  {/* Laser Scanning Animation when analyzing */}
                  {isAnalyzing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80">
                      <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-white to-transparent absolute animate-bounce" />
                      <div className="bg-zinc-900/90 text-white px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-2 shadow-lg border border-zinc-700">
                        <Sparkles className="w-4 h-4 text-zinc-300 animate-spin" />
                        <span>AI가 내역을 정밀 분석하고 있습니다... {analyzingProgress}</span>
                      </div>
                    </div>
                  )}

                  {/* Retake / Add Image Buttons */}
                  <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => appendFileInputRef.current?.click()}
                      className="bg-zinc-900/85 hover:bg-zinc-900 text-white text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 border border-zinc-700 shadow transition"
                    >
                      <Plus className="w-3 h-3" />
                      사진 추가
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-zinc-900/85 hover:bg-zinc-900 text-white text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 border border-zinc-700 shadow transition"
                    >
                      <RotateCcw className="w-3 h-3" />
                      다시 선택
                    </button>
                  </div>
                </div>

                {/* Multi-image thumbnail strip if multiple files uploaded */}
                {previewUrls.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {previewUrls.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActivePreviewIdx(idx)}
                        className={`w-12 h-12 rounded-xl overflow-hidden border-2 flex-shrink-0 transition ${
                          activePreviewIdx === idx
                            ? 'border-zinc-900 scale-105'
                            : 'border-zinc-200 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={url} alt={`thumb-${idx}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Single Form OR Multi-Item Batch Review List */}
              <form
                onSubmit={handleSubmit}
                className={`${isMultiMode ? 'lg:col-span-8' : ''} flex flex-col space-y-3`}
              >
                {errorMsg && (
                  <div className="p-2.5 bg-rose-50 text-rose-700 text-xs rounded-xl flex items-center gap-1.5 border border-rose-200">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {isMultiMode ? (
                  /* ==========================================
                   * MULTI-TRANSACTION BATCH REVIEW UI (2+ items)
                   * ========================================== */
                  <div className="flex flex-col space-y-2.5">
                    {/* Top Control Bar */}
                    <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-zinc-100/80 rounded-full border border-zinc-200/70">
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = !allBatchChecked;
                          setBatchItems((prev) => prev.map((item) => ({ ...item, checked: nextVal })));
                        }}
                        className="flex items-center gap-2 cursor-pointer text-xs font-bold text-zinc-900"
                      >
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center transition ${
                            allBatchChecked
                              ? 'bg-zinc-900 text-white'
                              : 'bg-white border border-zinc-300 text-transparent'
                          }`}
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                        <span>
                          전체 선택 ({selectedBatchCount}/{batchItems.length}건)
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleAddManualRow}
                        className="px-3 py-1 bg-white hover:bg-zinc-50 text-zinc-800 text-[11px] font-semibold rounded-full border border-zinc-200 shadow-2xs transition flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>항목 직접 추가</span>
                      </button>
                    </div>

                    {/* Scrollable Item Cards */}
                    <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                      {batchItems.map((item) => {
                        const isPoint = item.type === 'point';
                        const isSaving = item.type === 'saving';
                        const isChecked = item.checked !== false;
                        const combinedTypeVal = isPoint
                          ? item.pointMode === 'use'
                            ? 'point_use'
                            : 'point_earn'
                          : isSaving
                          ? 'saving'
                          : item.type === 'income'
                          ? 'income'
                          : item.necessity === 'want'
                          ? 'expense_want'
                          : 'expense_need';

                        const handleCombinedTypeChange = (val) => {
                          if (val === 'expense_need') {
                            handleUpdateBatchItem(item.tempId, { type: 'expense', necessity: 'need' });
                          } else if (val === 'expense_want') {
                            handleUpdateBatchItem(item.tempId, { type: 'expense', necessity: 'want' });
                          } else if (val === 'saving') {
                            handleUpdateBatchItem(item.tempId, { type: 'saving' });
                          } else if (val === 'income') {
                            handleUpdateBatchItem(item.tempId, { type: 'income' });
                          } else if (val === 'point_earn') {
                            handleUpdateBatchItem(item.tempId, { type: 'point', pointMode: 'earn' });
                          } else if (val === 'point_use') {
                            handleUpdateBatchItem(item.tempId, { type: 'point', pointMode: 'use' });
                          }
                        };

                        return (
                          <div
                            key={item.tempId}
                            className={`p-3 sm:p-3.5 rounded-3xl border transition space-y-2.5 ${
                              isChecked
                                ? 'bg-white border-zinc-200/90 shadow-2xs'
                                : 'bg-zinc-50/60 border-zinc-200/50 opacity-55'
                            }`}
                          >
                            {/* Row 1: Circular Check + Pill Capsule Dropdown + Pill Date + Delete */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateBatchItem(item.tempId, { checked: !isChecked })
                                  }
                                  className={`w-5 h-5 rounded-full flex items-center justify-center transition flex-shrink-0 ${
                                    isChecked
                                      ? 'bg-zinc-900 text-white'
                                      : 'bg-zinc-100 border border-zinc-300 text-transparent'
                                  }`}
                                >
                                  <Check className="w-3 h-3 stroke-[3]" />
                                </button>

                                <div className="relative inline-flex items-center">
                                  <select
                                    value={combinedTypeVal}
                                    onChange={(e) => handleCombinedTypeChange(e.target.value)}
                                    className="appearance-none text-[11px] font-bold pl-3 pr-6 py-1 rounded-full bg-zinc-900 text-white border border-zinc-900 outline-none cursor-pointer"
                                  >
                                    <option value="expense_need" className="bg-white text-zinc-900">
                                      지출 · 필수
                                    </option>
                                    <option value="expense_want" className="bg-white text-zinc-900">
                                      지출 · 선택
                                    </option>
                                    <option value="saving" className="bg-white text-zinc-900">
                                      저축 · 투자
                                    </option>
                                    <option value="income" className="bg-white text-zinc-900">
                                      수입
                                    </option>
                                    <option value="point_earn" className="bg-white text-zinc-900">
                                      포인트 +적립
                                    </option>
                                    <option value="point_use" className="bg-white text-zinc-900">
                                      포인트 -사용
                                    </option>
                                  </select>
                                  <ChevronDown className="w-3 h-3 text-zinc-300 absolute right-2 pointer-events-none" />
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <input
                                  type="date"
                                  value={item.date}
                                  onChange={(e) =>
                                    handleUpdateBatchItem(item.tempId, { date: e.target.value })
                                  }
                                  className="text-[11px] font-medium text-zinc-600 px-2.5 py-1 bg-zinc-100/80 border border-zinc-200/80 rounded-full outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBatchItem(item.tempId)}
                                  className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition flex-shrink-0"
                                  title="이 항목 삭제"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Row 2: Merchant & Amount (Rounded-2xl / full pill inputs) */}
                            <div className="grid grid-cols-12 gap-2">
                              <div className="col-span-7">
                                <input
                                  type="text"
                                  required={isChecked}
                                  placeholder={
                                    isPoint
                                      ? '포인트 적립/사용 내용'
                                      : isSaving
                                      ? '저축·투자 상품명'
                                      : '상호 / 사용처'
                                  }
                                  value={item.merchant}
                                  onChange={(e) =>
                                    handleUpdateBatchItem(item.tempId, { merchant: e.target.value })
                                  }
                                  className="w-full text-xs font-semibold px-3.5 py-2 bg-zinc-50 border border-zinc-200/90 rounded-2xl focus:bg-white focus:ring-1 focus:ring-zinc-900 outline-none transition"
                                />
                              </div>
                              <div className="col-span-5 relative">
                                <input
                                  type="number"
                                  required={isChecked}
                                  placeholder="금액"
                                  value={item.amount}
                                  onChange={(e) =>
                                    handleUpdateBatchItem(item.tempId, { amount: e.target.value })
                                  }
                                  className="w-full text-xs font-extrabold pl-3 pr-7 py-2 bg-zinc-50 border border-zinc-200/90 rounded-2xl focus:bg-white focus:ring-1 focus:ring-zinc-900 outline-none text-right transition"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-zinc-400">
                                  {isPoint ? 'P' : '원'}
                                </span>
                              </div>
                            </div>

                            {/* Row 3: Category & Payment Method (Custom Pill Selects, hidden for Point items) */}
                            {!isPoint && (
                              <div className="grid grid-cols-2 gap-2">
                                <div className="relative">
                                  <select
                                    value={item.category}
                                    onChange={(e) =>
                                      handleUpdateBatchItem(item.tempId, {
                                        category: e.target.value
                                      })
                                    }
                                    className="appearance-none w-full text-[11px] font-medium text-zinc-700 pl-3.5 pr-7 py-1.5 bg-zinc-50 border border-zinc-200/90 rounded-full outline-none cursor-pointer"
                                  >
                                    {CATEGORIES.filter((c) => c.name !== '포인트').map((c) => (
                                      <option key={c.id} value={c.name}>
                                        {c.name}
                                      </option>
                                    ))}
                                  </select>
                                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                                <div className="relative">
                                  <select
                                    value={item.payment_method}
                                    onChange={(e) =>
                                      handleUpdateBatchItem(item.tempId, {
                                        payment_method: e.target.value
                                      })
                                    }
                                    className="appearance-none w-full text-[11px] font-medium text-zinc-700 pl-3.5 pr-7 py-1.5 bg-zinc-50 border border-zinc-200/90 rounded-full outline-none cursor-pointer"
                                  >
                                    {PAYMENT_METHODS.map((m) => (
                                      <option key={m} value={m}>
                                        {m}
                                      </option>
                                    ))}
                                  </select>
                                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Batch Submit Button */}
                    <button
                      type="submit"
                      disabled={isAnalyzing || selectedBatchCount === 0}
                      className="w-full mt-1 py-3 px-4 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-xs transition active:scale-[0.99] flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>선택한 {selectedBatchCount}건 한꺼번에 가계부에 저장하기</span>
                    </button>
                  </div>
                ) : (
                  /* ==========================================
                   * SINGLE-TRANSACTION FORM UI (1 item)
                   * ========================================== */
                  <>
                    {/* Type Selection + Add Row Button */}
                    <div className="flex items-center gap-1.5">
                      <div className="flex flex-1 bg-zinc-100 rounded-xl p-1 text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              type: 'expense',
                              category: ['저축/투자', '포인트'].includes(formData.category)
                                ? '식비'
                                : formData.category,
                              payment_method:
                                formData.payment_method === '네이버페이(포인트)'
                                  ? '신용카드'
                                  : formData.payment_method
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
                              category: ['저축/투자', '포인트'].includes(formData.category)
                                ? '급여'
                                : formData.category,
                              payment_method:
                                formData.payment_method === '네이버페이(포인트)'
                                  ? '계좌이체'
                                  : formData.payment_method
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

                      <button
                        type="button"
                        onClick={handleAddManualRow}
                        className="px-2.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] font-semibold rounded-xl transition flex items-center gap-1 whitespace-nowrap flex-shrink-0"
                        title="항목 추가하여 다중 모드로 전환"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>항목 추가</span>
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
                            <span
                              className={`text-[10px] ${
                                formData.pointMode !== 'use' ? 'text-zinc-300' : 'text-zinc-400'
                              }`}
                            >
                              (모은 포인트)
                            </span>
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
                            <span
                              className={`text-[10px] ${
                                formData.pointMode === 'use' ? 'text-zinc-300' : 'text-zinc-400'
                              }`}
                            >
                              (쓴 포인트)
                            </span>
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
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                formData.necessity !== 'want' ? 'bg-zinc-200' : 'bg-slate-400'
                              }`}
                            />
                            <span>필수</span>
                            <span
                              className={`text-[10px] ${
                                formData.necessity !== 'want' ? 'text-zinc-300' : 'text-slate-400'
                              }`}
                            >
                              (생활비)
                            </span>
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
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                formData.necessity === 'want' ? 'bg-zinc-400' : 'bg-slate-400'
                              }`}
                            />
                            <span>선택</span>
                            <span
                              className={`text-[10px] ${
                                formData.necessity === 'want' ? 'text-zinc-300' : 'text-slate-400'
                              }`}
                            >
                              (아낄 돈)
                            </span>
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
                              onChange={(e) =>
                                setFormData({ ...formData, payment_method: e.target.value })
                              }
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
                          <span>
                            네이버페이 포인트 +{formatKRW(detectedEarnedPoint).replace('원', '')}P 적립도 함께 기록
                          </span>
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
                      className="w-full mt-2 py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-[0.99] flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>가계부에 저장하기</span>
                    </button>
                  </>
                )}
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
