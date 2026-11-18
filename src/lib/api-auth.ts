import "server-only";

export function normalizeApiKey(value: string) {
  let key = value.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  key = key
    .replace(/^(?:authorization|api-key)\s*:\s*/i, "")
    .replace(/^bearer\s+/i, "")
    .trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  return key;
}

export function getApiAuthHeaders(baseUrl: string, value: string) {
  const key = normalizeApiKey(value);
  const headers: Record<string, string> = {};
  if (new URL(baseUrl).hostname === "api.xiaomimimo.com") {
    headers["api-key"] = key;
  } else {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}
