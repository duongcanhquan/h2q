export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function isRetryable(err: unknown) {
  return err instanceof ApiError && (err.status === 0 || err.status >= 500);
}
