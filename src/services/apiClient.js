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

export function refreshUserReport(nickname, options = {}) {
  return request(`/api/user-report/refresh?nickname=${encodeURIComponent(nickname)}`, {
    method: "POST",
    ...options,
  });
}

export function subscribeUserReportStream(nickname, { onEvent, onError, onClose } = {}) {
  const controller = new AbortController();
  const url = createApiUrl(`/api/user-report/stream?nickname=${encodeURIComponent(nickname)}`);

  (async () => {
    let response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "text/event-stream",
          [getApiKeyHeader()]: getApiKey(),
        },
      });
    } catch (err) {
      if (err.name !== "AbortError") onError?.(err);
      return;
    }

    if (!response.ok) {
      onError?.(new ApiError(`Stream request failed with status ${response.status}`, response.status));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          onClose?.();
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const raw = line.slice(6).trim();
            if (!raw) continue;
            try {
              onEvent?.(JSON.parse(raw));
            } catch (_) {}
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") onError?.(err);
    }
  })();

  return () => controller.abort();
}

export function getPatchnotes(limit, options = {}) {
  const query = limit != null ? `?limit=${encodeURIComponent(limit)}` : "";
  return request(`/api/patchnotes${query}`, { method: "GET", ...options });
}

export function getPatchnoteDetail(patchId, options = {}) {
  return request(`/api/patchnotes/${encodeURIComponent(patchId)}`, {
    method: "GET",
    ...options,
  });
}

export const apiContractNotes = [
  "Game_web reads data from Game_api only.",
  "Authentication is sent with the configured API key header on every request.",
  "Statistics and user-report pages now use the same service-layer boundary.",
];
