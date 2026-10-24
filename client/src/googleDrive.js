/**
 * Google Drive Sync Utility using Google Identity Services & Google Drive REST API v3
 */

const FILE_NAME = 'budget_data.json';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

/**
 * Initialize OAuth2 Token Client
 */
export function initGoogleAuth(clientId, onTokenCallback) {
  if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
    throw new Error('Google Identity Services SDK가 아직 로드되지 않았습니다.');
  }

  const tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: (tokenResponse) => {
      if (tokenResponse && tokenResponse.access_token) {
        onTokenCallback(tokenResponse.access_token);
      }
    }
  });

  return tokenClient;
}

/**
 * Fetch basic user info
 */
export async function getGoogleUserInfo(accessToken) {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (_) {}
  return null;
}

/**
 * Find or create budget_data.json file in user's Google Drive
 */
export async function findOrCreateBudgetFile(accessToken) {
  // 1. Search for existing file
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${FILE_NAME}' and trashed=false&fields=files(id,name)`;
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!searchRes.ok) {
    throw new Error('구글 드라이브 파일 검색 실패');
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // 2. Create file if not found
  const metadata = {
    name: FILE_NAME,
    mimeType: 'application/json',
    description: '가계부 자동 동기화 데이터'
  };

  const initialContent = JSON.stringify({
    version: '1.0',
    updatedAt: new Date().toISOString(),
    transactions: [],
    wishlist: [],
    settings: {}
  });

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append(
    'file',
    new Blob([initialContent], { type: 'application/json' })
  );

  const createRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form
    }
  );

  if (!createRes.ok) {
    throw new Error('구글 드라이브 파일 생성 실패');
  }

  const createData = await createRes.json();
  return createData.id;
}

/**
 * Load budget data from Google Drive
 */
export async function loadFromGoogleDrive(accessToken, fileId) {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    throw new Error('구글 드라이브 데이터 읽기 실패');
  }

  return await res.json();
}

/**
 * Save budget data to Google Drive
 */
export async function saveToGoogleDrive(accessToken, fileId, data) {
  const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
  const content = JSON.stringify({
    ...data,
    updatedAt: new Date().toISOString()
  });

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: content
  });

  if (!res.ok) {
    throw new Error('구글 드라이브 데이터 저장 실패');
  }

  return true;
}
