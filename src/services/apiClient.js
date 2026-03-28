const DEFAULT_API_BASE = "http://172.30.1.50:8888";
const DEFAULT_API_KEY_HEADER = "X-API-Key";
const DEFAULT_API_KEY = "game-api-local-7f3c9a1b2d4e8f60";

export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export function getApiBase() {
  const envBase = import.meta.env.VITE_API_BASE;
  return (envBase || DEFAULT_API_BASE).replace(/\/+$/, "");
}

export function getApiKeyHeader() {
  return (import.meta.env.VITE_API_KEY_HEADER || DEFAULT_API_KEY_HEADER).trim();
}

export function getApiKey() {
  return (import.meta.env.VITE_API_KEY || DEFAULT_API_KEY).trim();
}

export function createApiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBase()}${normalizedPath}`;
}

function buildHeaders(extraHeaders) {
  const apiKeyHeader = getApiKeyHeader();
  const apiKey = getApiKey();

  return {
    Accept: "application/json",
    [apiKeyHeader]: apiKey,
    ...extraHeaders,
  };
}

async function parseResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (_) {
    return text;
  }
}

async function request(path, options = {}) {
  const response = await fetch(createApiUrl(path), {
    ...options,
    headers: buildHeaders(options.headers),
  });

  const body = await parseResponseBody(response);

  if (!response.ok) {
    const detail =
      typeof body === "object" && body !== null && "detail" in body ? body.detail : body;
    throw new ApiError(
      `Request failed with status ${response.status}`,
      response.status,
      detail,
    );
  }

  return body;
}

export function getVersions(options = {}) {
  return request("/versions", { method: "GET", ...options });
}

export function getCharacterStatistics(version, options = {}) {
  return request(`/stats/character/${encodeURIComponent(version)}`, {
    method: "GET",
    ...options,
  });
}

export function requestUserReport(nickname, options = {}) {
  return request(`/api/user-report?nickname=${encodeURIComponent(nickname)}`, {
    method: "GET",
    ...options,
  });
}

export function getUserReportStatus(jobId, options = {}) {
  return request(`/api/user-report/status?jobId=${encodeURIComponent(jobId)}`, {
    method: "GET",
    ...options,
  });
}

export function getHealth(options = {}) {
  return request("/health", { method: "GET", ...options });
}

export const apiContractNotes = [
  "Game_web reads data from Game_api only.",
  "Authentication is sent with the configured API key header on every request.",
  "Statistics and user-report pages now use the same service-layer boundary.",
];
