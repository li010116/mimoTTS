import "server-only";
import { getApiSettings } from "./store";
import { getApiAuthHeaders, normalizeApiKey } from "./api-auth";

export function getApiEndpoint(
  baseUrl: string,
  resource: "chat/completions" | "models",
) {
  const endpoint = new URL(baseUrl);
  const basePath = endpoint.pathname
    .replace(/\/+$/, "")
    .replace(/\/chat\/completions$/, "");
  endpoint.pathname = `${basePath}/${resource}`;
  return endpoint;
}

export async function getApiErrorMessage(response: Response, apiKey: string) {
  const errors: Record<number, string> = {
    401: "服务拒绝了鉴权请求，请核对当前地址对应的 API Key。",
    402: "服务已响应，但账户余额或额度不足。",
    403: "服务已响应，但当前 API Key 没有访问权限。",
    404: "找不到 API 接口，请检查服务地址。",
    429: "服务已响应，但请求过于频繁或配额已用尽，请稍后再试。",
  };
  const summary =
    errors[response.status] ?? "API 请求未成功，请检查配置或稍后重试。";
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: unknown; code?: unknown } | string;
    message?: unknown;
    detail?: unknown;
    code?: unknown;
  } | null;
  const providerError = payload?.error;
  const message =
    typeof providerError === "string"
      ? providerError
      : providerError?.message ?? payload?.message ?? payload?.detail;
  const code =
    typeof providerError === "object" && providerError !== null
      ? providerError.code ?? payload?.code
      : payload?.code;
  const detail = [code, message]
    .filter(
      (value): value is string | number =>
        typeof value === "string" || typeof value === "number",
    )
    .join(" · ");
  const redacted = (apiKey ? detail.split(apiKey).join("[Key 已隐藏]") : detail)
    .replace(/\s+/g, " ")
    .slice(0, 600);
  return `${summary}（HTTP ${response.status}）${redacted ? ` ${redacted}` : ""}`;
}

export async function testApiConnection(settings: {
  apiKey?: string;
  baseUrl?: string;
}) {
  const saved = getApiSettings();
  const apiKey = normalizeApiKey(settings.apiKey || "") || saved.apiKey;
  const baseUrl = settings.baseUrl ?? saved.baseUrl;
  if (!apiKey) {
    return Response.json(
      { error: "请先填写 API Key，再测试连接。" },
      { status: 400 },
    );
  }

  const started = performance.now();
  try {
    const response = await fetch(getApiEndpoint(baseUrl, "models"), {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...getApiAuthHeaders(baseUrl, apiKey),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      return Response.json(
        { error: await getApiErrorMessage(response, apiKey) },
        { status: response.status },
      );
    }

    const result: unknown = await response.json();
    if (
      !result ||
      typeof result !== "object" ||
      !("data" in result) ||
      !Array.isArray(result.data)
    ) {
      return Response.json(
        { error: "服务返回的模型列表格式不兼容，请检查 API 地址。" },
        { status: 502 },
      );
    }

    return Response.json({
      message: "连接成功，模型列表接口可访问。",
      latencyMs: Math.round(performance.now() - started),
    });
  } catch (error) {
    let message = "连接失败，请检查服务地址、网络或服务是否已启动。";
    if (
      error instanceof Error &&
      ["TimeoutError", "AbortError"].includes(error.name)
    ) {
      message = "连接超时（10 秒），请检查服务地址或网络后重试。";
    } else if (error instanceof SyntaxError) {
      message = "服务返回了非 JSON 数据，请检查是否填写了正确的 API 地址。";
    }
    return Response.json({ error: message }, { status: 502 });
  }
}
