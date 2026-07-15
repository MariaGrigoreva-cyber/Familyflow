const API_URL = process.env.REACT_APP_API_URL;

function getToken() {
  return localStorage.getItem('ff_token');
}

async function request(path, options = {}) {
  if (!API_URL) {
    throw new Error('Не задан REACT_APP_API_URL');
  }

  const token = getToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const error = new Error(
      data?.error ||
      data?.message ||
      `Ошибка запроса: ${response.status}`
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}

export async function register(email, password, familyName) {
  const result = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      familyName,
    }),
  });

  if (result?.token) {
    localStorage.setItem('ff_token', result.token);
  }

  return result;
}

export async function login(email, password) {
  const result = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
    }),
  });

  if (result?.token) {
    localStorage.setItem('ff_token', result.token);
  }

  return result;
}

export function logout() {
  localStorage.removeItem('ff_token');
  localStorage.removeItem('ff_cloud_updated_at');
}

export function isLoggedIn() {
  return Boolean(getToken());
}

export async function loadCloudState() {
  return request('/state', {
    method: 'GET',
  });
}

export async function saveCloudState(data, baseUpdatedAt = null) {
  return request('/state', {
    method: 'PUT',
    body: JSON.stringify({
      data,
      baseUpdatedAt,
    }),
  });
}