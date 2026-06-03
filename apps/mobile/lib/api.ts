const BASE_URL = 'https://trailtag-production.up.railway.app';

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  token?: string
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json();
  console.log('API Response:', res.status, data);

  if (!res.ok) {
    throw new Error(data.message ?? 'API Fehler');
  }

  return data;
}