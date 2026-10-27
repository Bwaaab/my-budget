const fs = require('fs');

function getTodayYMD() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getNowHM() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Call Gemini Vision to extract household budget data from an image buffer or base64.
 * @param {Buffer} imageBuffer
 * @param {string} mimeType
 * @param {string} apiKey
 */
async function recognizeReceiptOrCapture(imageBuffer, mimeType = 'image/jpeg', apiKey = '') {
  if (!apiKey) {
    // If no API key is provided, return guidance without fake pre-filled values
    return {
      success: false,
      requiresKey: true,
      message: 'Gemini API 키가 등록되지 않았습니다. 우측 상단 ⚙️ 설정에서 무료 Gemini API 키를 입력하시면 실시간 영수증/캡처 AI 자동 인식이 즉시 활성화됩니다!',
      extracted: null
    };
  }

  const base64Data = imageBuffer.toString('base64');

  const systemInstruction = `
당신은 한국 가계부 지출/수입 영수증 및 결제 내역 캡처본 분석 전문 AI입니다.
입력된 이미지(종이 영수증, 모바일 카드 결제 문자/푸시 알림 캡처, 토스/카카오페이 송금 및 결제 내역, 배달의민족 등 주문 영수증)를 정밀하게 분석하여 가계부에 입력할 정보를 JSON 형식으로만 추출하세요.

추출 규칙:
1. type: 일반 지출은 "expense", 저축·투자(주식/ETF/코인 매수, 적금/예금/청약/ISA/연금/증권계좌 납입·이체)는 "saving", 수입이나 환급/입금은 "income"
2. necessity: 지출(expense)인 경우 필수 생활비(기본 식사, 장보기, 통근 교통, 주거, 공과금, 의료 등)는 "need", 선택적/아낄 수 있었던 지출(카페/간식, 디저트, 외식, 배달야식, 쇼핑, 문화/취미, 택시 등)은 "want"
3. amount: 영수증/화면의 '수수료 0원', '할인 0원', '혜택 0원' 등 부가 항목이 아니라, **실제로 결제/출금/이체/투자된 총 핵심 금액**을 쉼표 없는 정수 숫자로만 추출하세요. (절대 0원으로 추출하지 마세요. 화면에 거래 금액이 있다면 그 금액을 최우선으로 추출하세요.)
4. merchant: 상호명 또는 투자 종목/증권사/수취인 이름 (예: "스타벅스 강남점", "토스증권 S&P500", "주택청약종합저축", "배달의민족", "쿠팡" 등).
5. date: 결제/거래 일자 ("YYYY-MM-DD" 형식). 연도가 없으면 현재 연도(${new Date().getFullYear()})를 기본값으로 사용.
6. time: 결제/거래 시각 ("HH:mm" 형식). 파악 불가 시 현재 시각 기준.
7. category: 내용에 가장 어울리는 카테고리 하나를 다음 중 선택:
   ["식비", "카페/간식", "마트/생필품", "교통", "문화/여가", "쇼핑", "의료/건강", "주거/통신", "저축/투자", "급여", "기타"]
7. payment_method: 결제 수단 (예: "신한카드", "국민카드", "현대카드", "체크카드", "카카오페이", "토스페이", "계좌이체", "현금" 등). 카드사나 결제앱 이름이 보이면 구체적으로 작성.
8. memo: 주요 품목이나 간단한 메모 (예: "아메리카노 외 1건", "점심 식사", "생필품 구매" 등).
9. items: 영수증에 개별 품목 목록이 보일 경우 [{ "name": "품목명", "price": 금액(숫자), "count": 수량(숫자) }] 형태로 추출 (없으면 빈 배열 []).
10. raw_summary: 전체 요약 1문장 (예: "스타벅스 강남점에서 신한카드로 12,500원 결제")

반드시 마크다운 코드블록(\`\`\`json) 없이 순수 JSON 객체만 반환하세요.
`;

  const payload = {
    contents: [
      {
        parts: [
          { text: systemInstruction },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: "application/json"
    }
  };

  // 후보군: 가장 빠른 3.5 Flash-Lite / 3.1 Flash-Lite 1순위, 그 다음 3.6 / 3.8 Flash
  const models = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite-preview',
    'gemini-3.1-flash-lite-preview',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-flash-lite-latest'
  ];
  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 오류 (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('AI 응답이 비어 있습니다.');
      }

      // Clean response text in case of markdown formatting
      const cleanJson = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(cleanJson);

      const isSaving =
        parsed.type === 'saving' ||
        parsed.category === '저축/투자' ||
        parsed.category === '저축' ||
        parsed.category === '투자';

      return {
        success: true,
        extracted: {
          type: isSaving ? 'saving' : parsed.type === 'income' ? 'income' : 'expense',
          necessity: isSaving ? 'need' : (parsed.necessity === 'want' ? 'want' : 'need'),
          amount: typeof parsed.amount === 'number' ? Math.abs(Math.round(parsed.amount)) : (Number(String(parsed.amount || '').replace(/[^0-9]/g, '')) || 0),
          merchant: parsed.merchant || '미상',
          date: parsed.date || getTodayYMD(),
          time: parsed.time || getNowHM(),
          category: isSaving ? '저축/투자' : parsed.category || '기타',
          payment_method: parsed.payment_method || '카드',
          memo: parsed.memo || '',
          items: Array.isArray(parsed.items) ? parsed.items : [],
          raw_summary: parsed.raw_summary || ''
        }
      };
    } catch (err) {
      lastError = err;
      console.warn(`Model ${model} failed, trying next if available:`, err.message);
    }
  }

  throw new Error(`영수증 분석 중 오류가 발생했습니다: ${lastError?.message}`);
}

module.exports = {
  recognizeReceiptOrCapture
};
