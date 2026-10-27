const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const QRCode = require('qrcode');
const dotenv = require('dotenv');

dotenv.config();

const { db, getSetting, setSetting } = require('./db');
const { recognizeReceiptOrCapture } = require('./ai');

const app = express();
const PORT = process.env.PORT || 5000;

// Setup directories
const uploadsDir = path.resolve(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Security: Sanitize image path to strictly allow only '/uploads/<safe-filename>'
function sanitizeImagePath(rawPath) {
  if (typeof rawPath !== 'string') return '';
  const trimmed = rawPath.trim();
  const match = trimmed.match(/^\/uploads\/([A-Za-z0-9._-]+)$/);
  if (!match) return '';
  const filename = match[1];
  if (filename.startsWith('.') || filename.includes('..')) return '';
  return `/uploads/${filename}`;
}

// Security: Resolve upload path safely within uploadsDir only (prevents arbitrary file deletion)
function resolveUploadFile(imagePath) {
  const safe = sanitizeImagePath(imagePath);
  if (!safe) return null;
  const basename = path.basename(safe);
  const fullPath = path.resolve(uploadsDir, basename);
  if (fullPath.startsWith(uploadsDir + path.sep)) {
    return fullPath;
  }
  return null;
}

function getLocalTodayYMD() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Multer storage for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `receipt-${Date.now()}-${Math.round(Math.random() * 1E6)}${ext}`);
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Serve static uploads
app.use('/uploads', express.static(uploadsDir));

// Helper: Get Local LAN IPv4 (prioritize real Wi-Fi / Ethernet over VPN like Radmin/Hamachi)
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  
  // 1. Look for Wi-Fi or Ethernet first
  const preferredNames = ['wi-fi', 'wifi', '이더넷', 'ethernet', 'wlan', 'lan'];
  for (const name of Object.keys(interfaces)) {
    const lower = name.toLowerCase();
    const isPreferred = preferredNames.some(p => lower.includes(p));
    const isVirtual = /radmin|hamachi|virtual|vethernet|tailscale|vmware|zerotier|loopback|bluetooth/i.test(lower);
    
    if (isPreferred && !isVirtual) {
      for (const net of interfaces[name]) {
        if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254') && !net.address.startsWith('26.')) {
          return net.address;
        }
      }
    }
  }

  // 2. Any non-virtual IPv4
  for (const name of Object.keys(interfaces)) {
    const lower = name.toLowerCase();
    if (!/radmin|hamachi|virtual|vethernet|tailscale|vmware|zerotier|loopback|bluetooth/i.test(lower)) {
      for (const net of interfaces[name]) {
        if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254') && !net.address.startsWith('26.')) {
          return net.address;
        }
      }
    }
  }

  return 'localhost';
}

// ================= API ROUTES =================

// 1. Network Info & QR Code for Smartphone connection
app.get('/api/network-info', async (req, res) => {
  try {
    const localIp = getLocalIp();
    // Use PORT (5000) which serves both frontend & backend
    const clientPort = PORT;
    const mobileUrl = `http://${localIp}:${clientPort}`;
    const qrCodeDataUrl = await QRCode.toDataURL(mobileUrl, {
      width: 256,
      margin: 2,
      color: {
        dark: '#1e1b4b',
        light: '#ffffff'
      }
    });

    res.json({
      localIp,
      port: clientPort,
      serverPort: PORT,
      mobileUrl,
      qrCodeDataUrl
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Settings
app.get('/api/settings', (req, res) => {
  try {
    const apiKey = getSetting('gemini_api_key') || process.env.GEMINI_API_KEY || '';
    const monthlyBudget = Number(getSetting('monthly_budget')) || 1200000;
    const googleSheetsUrl = getSetting('google_sheets_url') || '';
    res.json({
      gemini_api_key: apiKey ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : '',
      hasApiKey: !!apiKey,
      monthly_budget: monthlyBudget,
      google_sheets_url: googleSheetsUrl
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', (req, res) => {
  try {
    const { gemini_api_key, monthly_budget, google_sheets_url } = req.body;
    if (gemini_api_key !== undefined && !gemini_api_key.includes('...')) {
      setSetting('gemini_api_key', gemini_api_key.trim());
    }
    if (monthly_budget !== undefined) {
      setSetting('monthly_budget', Number(monthly_budget) || 1200000);
    }
    if (google_sheets_url !== undefined) {
      setSetting('google_sheets_url', google_sheets_url.trim());
    }
    res.json({ success: true, message: '설정이 저장되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Transactions CRUD
app.get('/api/transactions', (req, res) => {
  try {
    const { year, month, type, category, search } = req.query;
    let query = 'SELECT * FROM transactions WHERE 1=1';
    const params = [];

    if (year && month) {
      const monthStr = String(month).padStart(2, '0');
      query += ' AND date LIKE ?';
      params.push(`${year}-${monthStr}%`);
    } else if (year) {
      query += ' AND date LIKE ?';
      params.push(`${year}-%`);
    }

    if (type && type !== 'all') {
      query += ' AND type = ?';
      params.push(type);
    }

    if (category && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }

    if (search && search.trim()) {
      query += ' AND (merchant LIKE ? OR memo LIKE ? OR payment_method LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY date DESC, time DESC, id DESC';

    const transactions = db.prepare(query).all(...params);
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions', (req, res) => {
  try {
    const {
      type = 'expense',
      amount,
      category,
      merchant,
      date,
      time = '',
      payment_method = '카드',
      memo = '',
      image_path = '',
      items_json = '[]'
    } = req.body;

    if (!amount || !merchant || !date || !category) {
      return res.status(400).json({ error: '필수 항목(금액, 상호, 날짜, 카테고리)을 입력해주세요.' });
    }

    const stmt = db.prepare(`
      INSERT INTO transactions (type, amount, category, merchant, date, time, payment_method, memo, image_path, items_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      type,
      Number(amount),
      category,
      merchant,
      date,
      time || '',
      payment_method,
      memo || '',
      sanitizeImagePath(image_path),
      typeof items_json === 'string' ? items_json : JSON.stringify(items_json)
    );

    const created = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/transactions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const {
      type,
      amount,
      category,
      merchant,
      date,
      time,
      payment_method,
      memo,
      image_path,
      items_json
    } = req.body;

    const stmt = db.prepare(`
      UPDATE transactions
      SET type = ?, amount = ?, category = ?, merchant = ?, date = ?, time = ?, payment_method = ?, memo = ?, image_path = ?, items_json = ?
      WHERE id = ?
    `);

    stmt.run(
      type,
      Number(amount),
      category,
      merchant,
      date,
      time || '',
      payment_method,
      memo || '',
      sanitizeImagePath(image_path),
      typeof items_json === 'string' ? items_json : JSON.stringify(items_json),
      id
    );

    const updated = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/transactions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const tx = db.prepare('SELECT image_path FROM transactions WHERE id = ?').get(id);
    if (tx && tx.image_path) {
      const fullPath = resolveUploadFile(tx.image_path);
      if (fullPath && fs.existsSync(fullPath)) {
        try { fs.unlinkSync(fullPath); } catch (_) {}
      }
    }
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Monthly Statistics
app.get('/api/stats/monthly', (req, res) => {
  try {
    const today = new Date();
    const year = req.query.year || today.getFullYear();
    const month = req.query.month || (today.getMonth() + 1);
    const monthStr = String(month).padStart(2, '0');
    const pattern = `${year}-${monthStr}%`;

    // Totals
    const totals = db.prepare(`
      SELECT 
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as totalExpense,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as totalIncome,
        COUNT(*) as totalCount
      FROM transactions
      WHERE date LIKE ?
    `).get(pattern);

    const totalExpense = totals.totalExpense || 0;
    const totalIncome = totals.totalIncome || 0;
    const balance = totalIncome - totalExpense;

    // Budget
    const monthlyBudget = Number(getSetting('monthly_budget')) || 1200000;
    const remainingBudget = monthlyBudget - totalExpense;
    const budgetPercent = monthlyBudget > 0 ? Math.round((totalExpense / monthlyBudget) * 100) : 0;

    // Category breakdown
    const categoryStats = db.prepare(`
      SELECT category, SUM(amount) as amount, COUNT(*) as count
      FROM transactions
      WHERE date LIKE ? AND type = 'expense'
      GROUP BY category
      ORDER BY amount DESC
    `).all(pattern);

    const categories = categoryStats.map(item => ({
      ...item,
      percentage: totalExpense > 0 ? Math.round((item.amount / totalExpense) * 100) : 0
    }));

    // Daily spending trend
    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyMap = {};
    for (let i = 1; i <= daysInMonth; i++) {
      const dayKey = `${year}-${monthStr}-${String(i).padStart(2, '0')}`;
      dailyMap[dayKey] = { day: String(i), expense: 0, income: 0 };
    }

    const dailyRows = db.prepare(`
      SELECT date, 
             SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense,
             SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income
      FROM transactions
      WHERE date LIKE ?
      GROUP BY date
    `).all(pattern);

    dailyRows.forEach(row => {
      if (dailyMap[row.date]) {
        dailyMap[row.date].expense = row.expense;
        dailyMap[row.date].income = row.income;
      }
    });

    const dailyTrend = Object.values(dailyMap);

    // Top 5 largest expenses
    const topExpenses = db.prepare(`
      SELECT * FROM transactions
      WHERE date LIKE ? AND type = 'expense'
      ORDER BY amount DESC
      LIMIT 5
    `).all(pattern);

    res.json({
      year: Number(year),
      month: Number(month),
      totalExpense,
      totalIncome,
      balance,
      monthlyBudget,
      remainingBudget,
      budgetPercent,
      categories,
      dailyTrend,
      topExpenses
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. AI Receipt & Capture Recognition
app.post('/api/ai/recognize', upload.single('image'), async (req, res) => {
  try {
    let buffer;
    let mimeType = 'image/jpeg';
    let savedImagePath = '';

    if (req.file) {
      buffer = fs.readFileSync(req.file.path);
      mimeType = req.file.mimetype;
      savedImagePath = `/uploads/${req.file.filename}`;
    } else if (req.body.imageBase64) {
      const matches = req.body.imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        mimeType = matches[1];
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(req.body.imageBase64, 'base64');
      }
      const filename = `receipt-${Date.now()}-${Math.round(Math.random() * 1E6)}.jpg`;
      const savePath = path.join(uploadsDir, filename);
      fs.writeFileSync(savePath, buffer);
      savedImagePath = `/uploads/${filename}`;
    } else {
      return res.status(400).json({ error: '인식할 이미지가 제공되지 않았습니다.' });
    }

    const apiKey = getSetting('gemini_api_key') || process.env.GEMINI_API_KEY || '';
    const result = await recognizeReceiptOrCapture(buffer, mimeType, apiKey);

    res.json({
      ...result,
      savedImagePath
    });
  } catch (err) {
    console.error('AI recognize error:', err);
    res.status(500).json({ error: err.message || '영수증 분석 중 문제가 발생했습니다.' });
  }
});

// 6. Google Sheets Integration
app.post('/api/google-sheets/sync', async (req, res) => {
  try {
    const url = getSetting('google_sheets_url');
    if (!url) {
      return res.status(400).json({ error: '구글 시트 연동 URL이 설정되지 않았습니다. 설정에서 등록해 주세요.' });
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`구글 시트 응답 오류 (${response.status})`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('구글 시트에서 올바른 배열 형태의 데이터를 받지 못했습니다.');
    }

    let addedCount = 0;
    const checkStmt = db.prepare(`
      SELECT id FROM transactions 
      WHERE date = ? AND amount = ? AND merchant = ? AND type = ?
    `);

    const insertStmt = db.prepare(`
      INSERT INTO transactions (type, amount, category, merchant, date, time, payment_method, memo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const syncAll = db.transaction(() => {
      for (const row of data) {
        if (!row.amount || !row.merchant || !row.date) continue;
        const type = row.type === 'income' ? 'income' : 'expense';
        const amount = Number(row.amount);
        const date = String(row.date).slice(0, 10);
        const merchant = String(row.merchant);

        const existing = checkStmt.get(date, amount, merchant, type);
        if (!existing) {
          insertStmt.run(
            type,
            amount,
            row.category || '기타',
            merchant,
            date,
            row.time || '',
            row.payment_method || '카드',
            row.memo || ''
          );
          addedCount++;
        }
      }
    });

    syncAll();
    res.json({ success: true, addedCount, totalFromSheet: data.length });
  } catch (err) {
    console.error('Google Sheets sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 7. Backup & Restore & Export CSV
app.get('/api/export-csv', (req, res) => {
  try {
    const transactions = db.prepare('SELECT * FROM transactions ORDER BY date DESC, time DESC').all();
    const headers = ['ID', '구분', '금액', '카테고리', '상호/사용처', '일자', '시간', '결제수단', '메모'];
    const rows = transactions.map(t => [
      t.id,
      t.type === 'expense' ? '지출' : '수입',
      t.amount,
      `"${(t.category || '').replace(/"/g, '""')}"`,
      `"${(t.merchant || '').replace(/"/g, '""')}"`,
      t.date,
      t.time || '',
      `"${(t.payment_method || '').replace(/"/g, '""')}"`,
      `"${(t.memo || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="budget-${getLocalTodayYMD()}.csv"`);
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/backup', (req, res) => {
  try {
    const transactions = db.prepare('SELECT * FROM transactions').all();
    const settings = db.prepare('SELECT * FROM settings').all();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="budget-backup-${Date.now()}.json"`);
    res.json({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      transactions,
      settings
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/restore', (req, res) => {
  try {
    const { transactions, settings } = req.body;
    if (!Array.isArray(transactions)) {
      return res.status(400).json({ error: '유효한 백업 데이터 형식이 아닙니다.' });
    }

    const insertTx = db.prepare(`
      INSERT OR REPLACE INTO transactions (id, type, amount, category, merchant, date, time, payment_method, memo, image_path, items_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const restoreAll = db.transaction(() => {
      for (const t of transactions) {
        insertTx.run(
          t.id || null,
          t.type || 'expense',
          t.amount,
          t.category,
          t.merchant,
          t.date,
          t.time || '',
          t.payment_method || '카드',
          t.memo || '',
          sanitizeImagePath(t.image_path),
          t.items_json || '[]'
        );
      }
      if (Array.isArray(settings)) {
        for (const s of settings) {
          setSetting(s.key, s.value);
        }
      }
    });

    restoreAll();
    res.json({ success: true, count: transactions.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend build if present
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`===============================================`);
  console.log(`✨ 가계부 백엔드 서버가 시작되었습니다!`);
  console.log(`💻 로컬 접속:   http://localhost:${PORT}`);
  console.log(`📱 모바일 접속: http://${localIp}:5173 (개발) 또는 http://${localIp}:${PORT}`);
  console.log(`===============================================`);
});
