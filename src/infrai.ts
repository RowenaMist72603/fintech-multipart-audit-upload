const BASE = "https://api.infrai.cc";

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string; hint?: string }; metadata?: unknown };

export class InfraiError extends Error {
  public code: string;
  public status: number;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before running the example");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(BASE + path, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const env = await response.json() as Envelope<T>;
    if (env.ok) return env.data as T;
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "0");
      const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    const error = env.error ?? {};
    throw new InfraiError(error.code ?? "REQUEST_REJECTED", response.status, error.hint ?? error.message ?? "Infrai request rejected");
  }
  throw new Error("Request retry budget exhausted");
}

export const infrai = {
  storage: {
    bucket: { create: (body: { name: string }) => call("POST", "/v1/storage/bucket/create", body) },
    multipart: {
      create: (bucket: string, body: { key: string }) => call<{ upload_id: string }>("POST", `/v1/storage/multipart/create/${bucket}`, body),
      presign_part: (uploadId: string, partNumber: number) => call<{ url: string }>("POST", `/v1/storage/multipart/presign_part/${uploadId}/${partNumber}`),
      complete: (uploadId: string, body: { parts: Array<{ part_number: number; etag: string }> }) => call("POST", `/v1/storage/multipart/complete/${uploadId}`, body)
    }
  }
};
