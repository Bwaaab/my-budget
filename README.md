# 💰 스마트 AI 가계부 (Smart AI Budget)

PC가 꺼져 있어도 **스마트폰에서 구글 시트로 24시간 언제든 입력**하고, **PC를 켰을 때 버튼 하나로 최신 내역을 동기화**하여 예쁜 대시보드와 통계로 관리할 수 있는 하이브리드 가계부입니다.

---

## 🌟 어떻게 작동하나요?

```
[밖에서 / 모바일]
스마트폰으로 영수증/결제 문자 캡처 
  ↓ (Gemini AI가 상호, 금액, 카테고리 자동 추출)
구글 스프레드시트(Google Sheets)에 24시간 실시간 저장 (PC 켜둘 필요 없음!)

----------------------------------------------------

[집에서 / PC]
PC에서 가계부 실행 (start.bat)
  ↓
[🔄 구글 시트 동기화] 버튼 1초 클릭
  ↓
모바일에서 입력했던 모든 내역이 PC 가계부로 싹 들어오며
차트, 잔여 예산, 카테고리 분석이 자동으로 업데이트!
```

---

## 🚀 1분 구글 시트 연동 방법

1. [구글 스프레드시트(새 문서 만들기)](https://sheets.new)를 엽니다.
2. 상단 메뉴에서 **확장 프로그램 > Apps Script**를 클릭합니다.
3. 기존 코드를 지우고 아래 스크립트를 붙여넣은 뒤 **저장(Ctrl+S)**합니다.
4. 우측 상단 **배포 > 새 배포** 클릭:
   - 유형 선택(톱니바퀴): **웹 앱 (Web App)** 선택
   - 액세스 권한: **모든 사용자 (Anyone)**로 변경
   - **배포** 버튼 클릭
5. 발급된 **웹 앱 URL**을 복사합니다.
6. 가계부 프로그램 상단 **⚙️ 설정**의 `구글 시트 웹 앱 URL` 칸에 붙여넣고 저장하면 완료!

### 📋 Google Apps Script 코드
```javascript
function doGet(e) {
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
}
```

---

## 📱 스마트폰에서 24시간 캡처 입력하기

1. PC 가계부 상단 **"스마트폰 연결"** 버튼을 누릅니다.
2. QR 코드를 폰으로 스캔하여 **모바일 캡처 페이지**(`http://...:5000/mobile.html`)를 엽니다.
3. 폰 브라우저 메뉴에서 **"홈 화면에 추가"**를 누르면 스마트폰 앱처럼 설치됩니다.
4. 이제 밖에서 결제 문자를 캡처하거나 영수증 사진을 올리면 **PC가 완전히 꺼져 있어도 구글 시트에 바로 기록**됩니다.

---

## 💻 PC에서 확인하기
- 가계부를 켜고 상단의 **[🔄 구글 시트 동기화]** 버튼을 누르면 폰에서 입력했던 내역이 즉시 동기화되어 통계와 차트로 확인할 수 있습니다!
