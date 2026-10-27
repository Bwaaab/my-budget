// Google Sheets Apps Script Authentication & Token Manager

const TOKEN_KEY = 'budget_sheets_token';

/**
 * Get current Google Sheets security token from localStorage
 */
export function getSheetsToken() {
  return (localStorage.getItem(TOKEN_KEY) || '').trim();
}

/**
 * Set security token in localStorage
 */
export function setSheetsToken(token) {
  const clean = (token || '').trim();
  if (clean) {
    localStorage.setItem(TOKEN_KEY, clean);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

/**
 * Generate a cryptographically secure random token (32 chars)
 */
export function generateRandomToken() {
  const bytes = new Uint8Array(24);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

/**
 * Ensure a security token exists, or generate one if absent
 */
export function ensureSheetsToken() {
  let token = getSheetsToken();
  if (!token) {
    token = generateRandomToken();
    setSheetsToken(token);
  }
  return token;
}

/**
 * Force regenerate token (invalidates previous QR codes & requires redeploying Apps Script)
 */
export function regenerateSheetsToken() {
  const newToken = generateRandomToken();
  setSheetsToken(newToken);
  return newToken;
}

/**
 * Build authenticated GET URL for Google Sheets with cache-buster and token
 */
export function buildSheetsGetUrl(rawUrl, tokenOverride = null) {
  if (!rawUrl) return '';
  const token = tokenOverride !== null ? tokenOverride : getSheetsToken();
  try {
    const url = new URL(rawUrl);
    url.searchParams.set('_t', String(Date.now()));
    if (token) {
      url.searchParams.set('token', token);
    }
    return url.toString();
  } catch (_) {
    const sep = rawUrl.includes('?') ? '&' : '?';
    const tParam = token ? `&token=${encodeURIComponent(token)}` : '';
    return `${rawUrl}${sep}_t=${Date.now()}${tParam}`;
  }
}
