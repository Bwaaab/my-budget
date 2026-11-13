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

  const currentYear = new Date().getFullYear();
  const todayStr = getTodayYMD();
  const systemInstruction = `
당신은 한국 가계부 지출/수입/저축/포인트 영수증 및 결제·입출금 내역 캡처본 분석 전문 AI입니다.
입력된 이미지를 정밀하게 분석하여 가계부에 입력할 거래 내역들을 JSON 형식({"transactions": [...]})으로 추출하세요.

[정밀 금액, 상호 및 날짜 앵커 규칙]
- **오늘 날짜 앵커**: 현재 기준 오늘 날짜는 **${todayStr}**입니다.
  - 영수증에 연도가 없거나 월/일 숫자가 잘려 흐릿한 경우(예: "11/13" 앞자리가 잘려 "1/13"으로 보임), 결제 시간(HH:mm)이나 카드 유효기간(MM/YY)을 거래일자로 절대 오인하지 말고 오늘 날짜(${todayStr}) 기준 가장 가까운 당일/최근 과거 일자로 정확히 판별하세요.
- **최종 결제 금액 우선**: 주문금액, 공급가액, 부가세(VAT), 봉사료, 할인금액, 카드번호 끝자리(4자리), 승인번호(8자리 등)와 절대 혼동하지 마세요. 반드시 구매자가 실제로 최종 결제/승인한 **"합계 / 결제금액 / 승인금액"**을 추출해야 합니다.
- **상호명(가맹점명)**: 사업자번호, 대표자 성명, 영수증 번호 대신 실제 매장 상호명(예: "스타벅스 강남점", "이마트 역삼점")을 추출하세요.
- **모바일 캡처/이체**: '수수료 0원'이나 거래 후 남은 '통장 잔액'은 거래 금액이 아닙니다. 실제 이체/출금/결제된 금액을 추출하세요.

[핵심 판별 규칙: 단건 영수증 vs 다중 거래 내역 리스트]
- **단일 결제 영수증 / 단건 송금·결제 상세 캡처** (예: 마트/식당 종이 영수증 1장, 배달앱 주문 상세 1건):
  세부 품목(사과, 우유 등)이 여러 줄 있더라도 실제로는 1번의 결제이므로 합계 금액 기준 **1개의 거래**로 추출하세요. (단, 화면에 "네이버페이 포인트 N원 적립" 같은 포인트 혜택이 함께 보이면 earned_point에 숫자를 넣으세요.)
- **다중 거래 내역 리스트 화면** (예: 은행/토스/카카오페이 입출금·결제 내역 목록, 카드사 승인내역 리스트, 네이버페이 포인트 적립/사용 내역 목록, 결제 문자 알림 목록):
  화면에 나열된 **서로 다른 각각의 거래/결제/입금/적립 내역 줄을 위에서부터 빠짐없이 개별 거래 객체로 분리**하여 "transactions" 배열에 모두 담으세요! (각 행의 잔액 표시는 거래 금액이 아니므로 제외하세요.)

각 거래 항목(transaction) 추출 규칙:
1. type: 일반 지출은 "expense", 저축·투자(주식/ETF/적금/예금/청약/ISA/연금 납입)는 "saving", 급여/환급/입금은 "income", 포인트 적립 내역은 "point_earn", 포인트 사용/차감 내역은 "point_use"
2. necessity: 지출(expense)인 경우 필수 생활비(기본 식사, 장보기, 교통, 주거, 공과금, 의료 등)는 "need", 선택적/아낄 수 있었던 소비(카페/간식, 디저트, 외식, 배달야식, 쇼핑, 문화/취미, 택시 등)는 "want"
3. amount: 수수료 0원이나 거래 후 잔액이 아닌, **실제 해당 건의 최종 거래/결제/이체/적립 금액**을 쉼표 없는 양의 정수 숫자로 추출하세요.
4. merchant: 상호명, 가맹점명, 수취인, 투자종목명, 또는 포인트 적립/사용 사유 (예: "스타벅스 강남점", "토스증권 S&P500", "네이버페이 구매 적립", "배달의민족").
5. date: 거래 일자 ("YYYY-MM-DD" 형식). 연도가 없으면 현재 연도(${currentYear})를 적용하세요.
6. time: 거래 시각 ("HH:mm" 형식). 파악 불가 시 현재 시각 기준.
7. category: 내용에 가장 어울리는 카테고리 하나를 선택:
   ["식비", "카페/간식", "마트/생필품", "교통", "문화/여가", "쇼핑", "의료/건강", "주거/통신", "저축/투자", "급여", "포인트", "기타"]
8. payment_method: 결제 수단 ("신용카드", "체크카드", "네이버페이", "네이버페이(포인트)", "카카오페이", "토스페이", "계좌이체", "현금" 등).
9. memo: 주요 품목이나 간단한 요약.
10. earned_point: 단건 결제 화면 하단에 부가적인 포인트 적립 문구가 있을 때만 적립 포인트 정수 숫자 (없거나 이미 type이 "point_earn"이면 0).
`;

  const responseSchema = {
    type: "OBJECT",
    properties: {
      transactions: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            type: {
              type: "STRING",
              enum: ["expense", "income", "saving", "point_earn", "point_use"]
            },
            necessity: {
              type: "STRING",
              enum: ["need", "want"]
            },
            amount: { type: "INTEGER" },
            merchant: { type: "STRING" },
            date: { type: "STRING" },
            time: { type: "STRING" },
            category: {
              type: "STRING",
              enum: [
                "식비",
                "카페/간식",
                "마트/생필품",
                "교통",
                "문화/여가",
                "쇼핑",
                "의료/건강",
                "주거/통신",
                "저축/투자",
                "급여",
                "포인트",
                "기타"
              ]
            },
            payment_method: { type: "STRING" },
            memo: { type: "STRING" },
            earned_point: { type: "INTEGER" }
          },
          required: ["type", "amount", "merchant", "date", "category", "payment_method"]
        }
      }
    },
    required: ["transactions"]
  };

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
      response_mime_type: "application/json",
      response_schema: responseSchema
    }
  };

  // 정확도와 속도 밸런스 최적화: 3.6/3.8/2.5 Flash를 1순위로 배치, 안정적 폴백 유지
  const models = [
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-2.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-flash-lite-latest'
  ];
  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      let response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // 혹시 해당 모델에서 response_schema 미지원(400)일 경우 스키마 제외 후 1회 재시도
      if (!response.ok && response.status === 400 && payload.generationConfig?.response_schema) {
        const fallbackPayload = {
          ...payload,
          generationConfig: {
            temperature: 0.1,
            response_mime_type: "application/json"
          }
        };
        const retryRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fallbackPayload)
        });
        if (retryRes.ok) {
          response = retryRes;
        }
      }

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

      const rawList = Array.isArray(parsed.transactions)
        ? parsed.transactions
        : Array.isArray(parsed)
        ? parsed
        : [parsed];

      const normalizeItem = (item) => {
        const isPoint =
          item.type === 'point' ||
          item.type === 'point_earn' ||
          item.type === 'point_use' ||
          item.category === '포인트' ||
          item.payment_method === '네이버페이(포인트)';

        const isSaving =
          !isPoint &&
          (item.type === 'saving' ||
            item.category === '저축/투자' ||
            item.category === '저축' ||
            item.category === '투자');

        return {
          type: isPoint
            ? item.type === 'point_use'
              ? 'point_use'
              : 'point_earn'
            : isSaving
            ? 'saving'
            : item.type === 'income'
            ? 'income'
            : 'expense',
          necessity: isSaving ? 'need' : item.necessity === 'want' ? 'want' : 'need',
          amount:
            typeof item.amount === 'number'
              ? Math.abs(Math.round(item.amount))
              : Number(String(item.amount || '').replace(/[^0-9]/g, '')) || 0,
          merchant: item.merchant || '미상',
          date: item.date || getTodayYMD(),
          time: item.time || getNowHM(),
          category: isPoint ? '포인트' : isSaving ? '저축/투자' : item.category || '기타',
          payment_method: isPoint ? '네이버페이(포인트)' : item.payment_method || '신용카드',
          memo: item.memo || '',
          items: Array.isArray(item.items) ? item.items : [],
          raw_summary: item.raw_summary || '',
          earned_point:
            typeof item.earned_point === 'number'
              ? Math.max(0, Math.round(item.earned_point))
              : Number(String(item.earned_point || '').replace(/[^0-9]/g, '')) || 0
        };
      };

      const transactions = rawList.map(normalizeItem).filter((t) => t.amount > 0);
      const first = transactions[0] || normalizeItem(rawList[0] || {});

      return {
        success: true,
        extracted: first,
        transactions: transactions.length > 0 ? transactions : [first]
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
