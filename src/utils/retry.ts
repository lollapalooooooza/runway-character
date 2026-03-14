import { sleep } from "./time.js";

export interface RetryOptions {
  retries: number;
  delayMs?: number | ((attempt: number) => number);
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number) => void | Promise<void>;
}

export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      attempt += 1;
      const shouldRetry = options.shouldRetry?.(error, attempt) ?? false;

      if (attempt > options.retries || !shouldRetry) {
        throw error;
      }

      await options.onRetry?.(error, attempt);

      const delayMs =
        typeof options.delayMs === "function"
          ? options.delayMs(attempt)
          : options.delayMs ?? 0;

      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }
}
