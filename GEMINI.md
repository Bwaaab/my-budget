# 🗺️ 스마트 AI 가계부 (Smart AI Budget) 프로젝트 지도 & 개발 가이드 (GEMINI.md)

이 문서는 프로젝트의 전체 구조, 핵심 파일별 역할, 데이터베이스 스키마 및 연동 아키텍처를 정리한 가이드 문서입니다.

---

## 📌 1. 프로젝트 개요

- **프로젝트명**: Smart AI Budget (스마트 AI 가계부)
- **핵심 목표**:
  1. **Gemini Vision AI 영수증/결제 캡처 자동 인식**: 종이 영수증, 카드 결제 문자, 토스/카카오페이 캡처를 업로드하면 일자, 금액, 상호, 카테고리, 결제수단, 품목을 자동 분석.
  2. **하이브리드 아키텍처 (PC 로컬 서버 + GitHub Pages Serverless)**:
     - PC 환경: Express + SQLite 기반의 완전한 로컬 데이터 관리 및 자동 백업.
     - 웹/모바일 환경: Google 스프레드시트(Apps Script) 및 브라우저 LocalStorage 기반 24시간 실시간 동기화.
  3. **위시리스트 & 지출 억제 플래너**: 갖고 싶은 물건을 등록하고, 남은 예산 및 AI 소비 조언과 연계하여 합리적 소비 유도.

---

## 🏗️ 2. 기술 스택

| 영역 | 기술 스택 | 설명 |
|---|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide React, Canvas Confetti | 빠르고 미려한 모던 반응형 웹/PWA 대시보드 |
| **Backend** | Node.js, Express, Better-SQLite3, Multer, QRCode | 로컬 REST API, SQLite 트랜잭션 관리, 영수증 파일 업로드, 모바일 연결 QR 생성 |
| **AI Engine** | Google Gemini 1.5/2.0 Flash (`@google/genai` & REST) | 영수증 및 카드 알림 캡처 다중 항목 OCR/JSON 구조화 분석, 위시리스트 소비 조언 |
| **Cloud/Sync** | Google Apps Script (Sheets API), PWA (Service Worker) | PC가 꺼져도 스마트폰에서 구글 시트에 24시간 기록 및 버튼 1클릭 양방향 동기화 |

---

## 📂 3. 전체 디렉터리 및 파일 맵 (File Map)

```text
D:\budget\
├── GEMINI.md                    # [본 문서] 프로젝트 전체 파일 지도 및 개발 가이드
├── README.md                    # 사용자 사용 설명서 (구글 시트 Apps Script 연동 코드 및 PWA 사용법)
├── package.json                 # 백엔드 및 통합 실행 npm 패키지 설정
├── package-lock.json            # 백엔드 의존성 락파일
├── .gitignore                   # Git 제외 설정 (node_modules, uploads, DB 등)
├── start.bat                    # 원클릭 프로덕션 실행 배치파일 (빌드 + 서버 구동 + 브라우저 오픈)
├── run-dev.bat                  # 개발 모드 동시 실행 (서버 & 클라이언트 핫리로드)
├── deploy-github.bat            # GitHub Pages 자동 빌드 및 배포 배치파일
│
├── data/                        # [데이터베이스 저장소]
│   ├── budget.db                # SQLite 데이터베이스 본체
│   ├── budget.db-wal            # SQLite WAL 로그 파일
│   └── budget.db-shm            # SQLite 공유 메모리 파일
│
├── uploads/                     # [영수증 이미지 저장소]
│   └── (영수증 및 결제 캡처 이미지 보관)
│
├── server/                      # [Node.js 백엔드]
│   ├── server.js                # Express 메인 서버 (REST API, 정적 파일 서빙, QR 코드, 백업 API)
│   ├── db.js                    # Better-SQLite3 연결 및 스키마 초기화, 기본 예산/샘플 데이터 시딩
│   └── ai.js                    # Gemini Vision API 영수증 OCR 프롬프트 및 분석 파이프라인
│
└── client/                      # [React 프론트엔드 (Vite)]
    ├── index.html               # SPA 진입점 HTML (PWA 메타태그, 폰트 설정)
    ├── vite.config.js           # Vite 빌드 설정 (React 플러그인, API 프록시)
    ├── package.json             # 프론트엔드 라이브러리 의존성 및 스크립트
    ├── README.md                # 프론트엔드 관련 안내
    │
    ├── public/                  # 정적 에셋 및 PWA 관련 파일
    │   ├── favicon.svg          # 파비콘 아이콘
    │   ├── icons.svg            # 공용 벡터 아이콘
    │   ├── icon-192.png         # PWA 192x192 앱 아이콘
    │   ├── icon-512.png         # PWA 512x512 앱 아이콘
    │   ├── manifest.json        # PWA 매니페스트 (홈 화면 추가, 독립 실행형 설정)
    │   └── sw.js                # 오프라인 캐싱 및 PWA 서비스 워커
    │
    └── src/                     # React 소스 코드
        ├── main.jsx             # React DOM 진입점 (서비스 워커 등록)
        ├── App.jsx              # 메인 애플리케이션 컴포넌트 (상태 관리, 서버/클라우드 동기화 오케스트레이션)
        ├── App.css              # 애플리케이션 공통 CSS
        ├── index.css            # Tailwind CSS 기본 디렉티브 및 글로벌 스타일
        ├── constants.js         # 카테고리, 결제수단, 색상 팔레트, 날짜 계산 및 로컬 복구/스냅샷 유틸 함수
        ├── sheetsAuth.js        # Google Sheets Apps Script 보안 토큰(AUTH TOKEN) 관리 모듈
        │
        ├── assets/              # 로고 및 그래픽 리소스
        │   ├── hero.png         # 메인 히어로 배너 이미지
        │   ├── react.svg        # React 기본 로고
        │   └── vite.svg         # Vite 기본 로고
        │
        └── components/          # UI 단위 컴포넌트 목록 (14개)
            ├── Header.jsx                # 상단 헤더 (월 선택, 구글 시트 동기화, 수동 추가, AI 스캔, 설정 버튼)
            ├── SummaryCards.jsx          # 주요 지표 카드 (총 지출, 총 수입, 남은 예산, 저축/투자, 소비 성향(필수/선택))
            ├── ChartsView.jsx            # 카테고리별 도넛/바 차트, 일별 지출 추이 그래프
            ├── TransactionList.jsx       # 거래 내역 리스트 (검색, 필터링, 정렬, 상세 모달 호출, 삭제/복구)
            ├── TransactionModal.jsx      # 수입/지출/저축 단건 수동 입력 및 수정 모달
            ├── AiScannerModal.jsx        # 영수증/결제 캡처 이미지 업로드 및 Gemini Vision 실시간 스캔 모달
            ├── ReceiptViewerModal.jsx    # 등록된 영수증 원본 이미지 확대 뷰어 모달
            ├── QrCodeModal.jsx           # 스마트폰 PWA 접속용 로컬 네트워크 접속 QR 모달
            ├── SettingsModal.jsx         # 월 예산 설정, Gemini API 키, 구글 시트 연동 URL/토큰 설정 모달
            ├── Wishlist.jsx              # 위시리스트 관리 탭 (사고 싶은 물건 목록, 쿨다운 타이머, 예산 대비 구매 평가)
            ├── WishlistAiScannerModal.jsx# 상품 이미지/캡처를 분석하여 위시리스트 품목/가격 자동 추출 모달
            ├── CategoryIcon.jsx          # 카테고리별 아이콘 매핑 렌더러
            ├── Logo.jsx                  # 반응형 로고 컴포넌트
            └── MobileBottomNav.jsx       # 모바일 환경 하단 탭 바 (홈, 내역, 위시리스트, 추가 바로가기)
```

---

## 🗄️ 4. 데이터베이스 및 스키마 구조 (SQLite)

`data/budget.db`에 저장되며 `server/db.js`에서 초기화됩니다.

### 1) `transactions` (거래 내역 테이블)
| 컬럼명 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `id` | INTEGER | PK AUTOINCREMENT | 고유 식별자 |
| `type` | TEXT | 'expense' | 구분 (`expense`: 지출, `income`: 수입, `saving`: 저축/투자) |
| `amount` | INTEGER | NOT NULL | 금액 (KRW 정수형) |
| `category` | TEXT | NOT NULL | 카테고리 (식비, 카페/간식, 마트/생필품, 교통, 쇼핑 등) |
| `merchant` | TEXT | NOT NULL | 사용처 / 상호명 / 수취인 |
| `date` | TEXT | NOT NULL | 일자 (`YYYY-MM-DD`) |
| `time` | TEXT | '' | 시간 (`HH:mm`) |
| `payment_method`| TEXT | '카드' | 결제 수단 (신용카드, 체크카드, 카카오페이, 현금 등) |
| `memo` | TEXT | '' | 메모 및 영수증 세부 품목 요약 |
| `image_path` | TEXT | '' | 업로드된 영수증 이미지 경로 (`/uploads/filename.jpg`) |
| `items_json` | TEXT | '[]' | 영수증 세부 품목 목록 (JSON 배열) |
| `created_at` | DATETIME| CURRENT_TIMESTAMP| 등록 일시 |

### 2) `settings` (시스템 및 사용자 환경설정)
| 키(`key`) | 기본값 | 설명 |
|---|---|---|
| `monthly_budget` | `1200000` | 월 권장 지출 예산 (원) |
| `budget_start_day` | `1` | 월별 예산 산정 기준일 (예: 1일, 25일 월급일 등) |
| `gemini_api_key` | (빈값) | 사용자의 Google Gemini API 키 (영수증 OCR 및 위시리스트 AI용) |
| `google_sheet_url`| (빈값) | 모바일/시트 연동용 Apps Script 웹 앱 배포 URL |
| `google_sheet_token`| (빈값) | 구글 시트 요청 위변조 방지용 비밀 토큰 |

---

## 🔌 5. 주요 백엔드 REST API 명세 (`server/server.js`)

- `GET /api/transactions` : 거래 목록 조회 (필터링: 월별, 카테고리별, 검색어)
- `POST /api/transactions` : 신규 거래 단건 등록
- `PUT /api/transactions/:id` : 거래 내역 수정
- `DELETE /api/transactions/:id` : 거래 내역 삭제 (연계된 영수증 파일 안전 삭제)
- `POST /api/transactions/bulk-sync` : 구글 시트 및 모바일 내역 일괄 병합 동기화
- `GET /api/stats` : 지정 연/월 통계 (총 수입/지출/저축, 카테고리별 비율, 일별 추이)
- `GET /api/settings` / `POST /api/settings` : 환경설정 조회 및 업데이트
- `POST /api/ai/scan-receipt` : 영수증/결제 캡처 이미지 업로드 및 Gemini Vision OCR 수행
- `GET /api/qr` : 스마트폰 접속을 위한 내부망 IP 기반 접속 QR 코드 생성
- `GET /api/backup` : 전체 데이터베이스 JSON 백업 파일 다운로드
- `POST /api/restore` : JSON 백업 파일 복원

---

## 🔄 6. 하이브리드 연동 흐름 (구글 시트 & 모바일)

1. **외출 중 (스마트폰)**:
   - 스마트폰 PWA 또는 웹 브라우저에서 구글 스프레드시트 웹 앱으로 지출 입력 (PC 오프라인 상태에서도 24시간 작동).
2. **집에서 (PC)**:
   - 가계부 실행 후 상단 **[🔄 구글 시트 동기화]** 클릭.
   - 구글 시트의 신규 행을 로컬 SQLite `transactions` 테이블로 가져오고 중복 방지 병합.
3. **영수증 스캔**:
   - PC 또는 모바일에서 영수증을 업로드하면 `server/ai.js`의 Gemini 프롬프트를 통해 금액, 상호, 카테고리, 결제수단이 정밀 추출되어 입력 폼에 자동 반영.

---

## 💻 7. 실행 및 배포 명령어

- **로컬 개발 실행 (서버 + 클라이언트 동시)**:
  ```bash
  npm run dev
  # 또는 run-dev.bat 더블클릭
  ```
- **로컬 단독 프로덕션 실행**:
  ```bash
  start.bat
  # client 빌드 후 node server/server.js 구동 및 기본 브라우저 자동 오픈
  ```
- **GitHub Pages 배포**:
  ```bash
  deploy-github.bat
  ```
