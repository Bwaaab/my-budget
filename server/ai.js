const fs = require('fs');

/**
 * Call Gemini Vision to extract household budget data from an image buffer or base64.
 * @param {Buffer} imageBuffer
 * @param {string} mimeType
 * @param {string} apiKey
 */
async function recognizeReceiptOrCapture(imageBuffer, mimeType = 'image/jpeg', apiKey = '') {
  if (!apiKey) {
    // If no API key is provided, return a friendly mock result or guidance
    return {
      success: false,
      requiresKey: true,
      message: 'Gemini API 키가 등록되지 않았습니다. 우측 상단 ⚙️ 설정에서 무료 Gemini API 키를 입력하시면 실시간 영수증/캡처 AI 자동 인식이 즉시 활성화됩니다!',
      extracted: {
        type: 'expense',
        amount: 12000,
        merchant: '가맹점/상호 (API 키 등록 필요)',
        date: new Date().toISOString().slice(0, 10),
        time: '12:00',
        category: '식비',
        payment_method: '카드',
        memo: 'Gemini API 키 설정 후 캡처하면 정확한 금액과 상호가 자동으로 채워집니다.',
        items: []
      }
    };
  }

  const base64Data = imageBuffer.toString('base64');

  const systemInstruction = `
당신은 한국 가계부 지출/수입 영수증 및 결제 내역 캡처본 분석 전문 AI입니다.
입력된 이미지(종이 영수증, 모바일 카드 결제 문자/푸시 알림 캡처, 토스/카카오페이 송금 및 결제 내역, 배달의민족 등 주문 영수증)를 정밀하게 분석하여 가계부에 입력할 정보를 JSON 형식으로만 추출하세요.

추출 규칙:
1. type: 지출은 "expense", 수입이나 환급/입금은 "income"
2. amount: 최종 결제 금액 또는 이체/입금 금액 (쉼표 없는 정수 숫자). 할인 적용 후 실 결제 금액 우선.
3. merchant: 상호명 또는 수취인/송금처 이름 (예: "스타벅스 강남점", "GS25", "배달의민족", "쿠팡", "홍길동" 등). 영수증 상단이나 승인내역의 가맹점명.
4. date: 결제/거래 일자 ("YYYY-MM-DD" 형식). 연도가 없으면 현재 연도(${new Date().getFullYear()})를 기본값으로 사용.
5. time: 결제/거래 시각 ("HH:mm" 형식). 파악 불가 시 현재 시각 기준.
6. category: 내용에 가장 어울리는 카테고리 하나를 다음 중 선택:
   ["식비", "카페/간식", "마트/생필품", "교통", "문화/여가", "쇼핑", "의료/건강", "주거/통신", "금융/보험", "급여", "기타"]
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

  // Try gemini-3.8-flash first, fallback to 2.5 and 1.5
  const models = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
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

      return {
        success: true,
        extracted: {
          type: parsed.type === 'income' ? 'income' : 'expense',
          amount: Number(parsed.amount) || 0,
          merchant: parsed.merchant || '미상',
          date: parsed.date || new Date().toISOString().slice(0, 10),
          time: parsed.time || '12:00',
          category: parsed.category || '기타',
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
