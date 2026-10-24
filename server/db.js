const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'budget.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL DEFAULT 'expense', -- 'expense' or 'income'
    amount INTEGER NOT NULL,
    category TEXT NOT NULL,
    merchant TEXT NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD
    time TEXT DEFAULT '', -- HH:mm
    payment_method TEXT DEFAULT '카드',
    memo TEXT DEFAULT '',
    image_path TEXT DEFAULT '',
    items_json TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
  CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
`);

// Initialize default settings if not exists
const getSetting = (key) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
};

const setSetting = (key, value) => {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));
};

if (!getSetting('monthly_budget')) {
  setSetting('monthly_budget', '1200000');
}

// Seed sample transactions if table is empty
const countRow = db.prepare('SELECT COUNT(*) as cnt FROM transactions').get();
if (countRow.cnt === 0) {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const d = (day) => `${year}-${month}-${String(day).padStart(2, '0')}`;

  const insertTx = db.prepare(`
    INSERT INTO transactions (type, amount, category, merchant, date, time, payment_method, memo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const samples = [
    ['income', 3200000, '급여', '(주)테크솔루션 급여', d(10), '09:00', '계좌이체', '10월 정기 급여'],
    ['expense', 14500, '식비', '김밥천국 역삼점', d(today.getDate() > 3 ? today.getDate() - 2 : 1), '12:30', '신용카드', '점심 제육덮밥+김밥'],
    ['expense', 4800, '카페/간식', '스타벅스', d(today.getDate() > 3 ? today.getDate() - 1 : 2), '13:15', '카카오페이', '아이스 아메리카노'],
    ['expense', 35000, '마트/생필품', '이마트 역삼점', d(today.getDate()), '19:40', '체크카드', '생필품 및 주말 장보기'],
    ['expense', 15200, '교통', '카카오T 택시', d(today.getDate() > 3 ? today.getDate() - 2 : 1), '22:10', '신한카드', '귀가 택시'],
    ['expense', 9900, '주거/통신', '넷플릭스 구독', d(5), '00:00', '자동이체', '월 정기 결제']
  ];

  const insertMany = db.transaction((rows) => {
    for (const row of rows) {
      insertTx.run(...row);
    }
  });

  insertMany(samples);
}

module.exports = {
  db,
  getSetting,
  setSetting
};
