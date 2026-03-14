import { TimeoutError } from "../errors.js";
import type {
  GeneratedAsset,
  GenerationJob,
  WaitForJobOptions,
} from "../types.js";
import type { Logger } from "../utils/logger.js";
import { sleep } from "../utils/time.js";

export interface GenerationJobRefresher {
  refreshJob(jobId: string): Promise<{ job: GenerationJob; assets: GeneratedAsset[] }>;
}

function isTerminalStatus(status: GenerationJob["status"]): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled";
}

export class PollingManager {
  constructor(
    private readonly refresher: GenerationJobRefresher,
    private readonly logger: Logger,
    private readonly defaultPollIntervalMs: number,
  ) {}

  async waitForJob(
    jobId: string,
    options: WaitForJobOptions = {},
  ): Promise<{ job: GenerationJob; assets: GeneratedAsset[]; attempts: number }> {
    const pollIntervalMs = options.pollIntervalMs ?? this.defaultPollIntervalMs;
    const timeoutMs = options.timeoutMs;
    const maxAttempts =
      options.maxAttempts ??
      (timeoutMs !== undefined
        ? Math.max(1, Math.ceil(timeoutMs / Math.max(pollIntervalMs, 1)))
        : 120);
    const startedAt = Date.now();
    let attempts = 0;

    while (true) {
      attempts += 1;
      const result = await this.refresher.refreshJob(jobId);

      if (isTerminalStatus(result.job.status)) {
        return { ...result, attempts };
      }

      if (attempts >= maxAttempts) {
        throw new TimeoutError(
          `Job ${jobId} did not complete within ${maxAttempts} polling attempts.`,
          {
            jobId,
            maxAttempts,
            lastKnownStatus: result.job.status,
          },
        );
      }

      if (timeoutMs !== undefined && Date.now() - startedAt >= timeoutMs) {
        throw new TimeoutError(
          `Job ${jobId} did not complete within ${timeoutMs}ms.`,
          {
            jobId,
            timeoutMs,
            lastKnownStatus: result.job.status,
          },
        );
      }

      this.logger.debug("Polling Runway generation job", {
        jobId,
        attempt: attempts,
        status: result.job.status,
      });

      if (pollIntervalMs > 0) {
        await sleep(pollIntervalMs);
      }
    }
  }
}
