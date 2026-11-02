export class FrappeApiError extends Error {
  status: number;
  payload?: unknown;

  constructor(message: string, status = 500, payload?: unknown) {
    super(message);
    this.name = "FrappeApiError";
    this.status = status;
    this.payload = payload;
  }
}

export function extractFrappeError(data: unknown, fallback = "Request failed"): string {
  if (!data || typeof data !== "object") return fallback;
  const obj = data as Record<string, unknown>;
  if (typeof obj._error_message === "string") return obj._error_message;
  if (typeof obj.exception === "string") return obj.exception.split("\n")[0]!;
  if (typeof obj.message === "string" && obj.message !== "success") return obj.message;
  if (typeof obj.error === "string") return obj.error;
  return fallback;
}
