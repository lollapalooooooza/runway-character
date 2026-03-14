import { describe, expect, it, vi } from "vitest";

import { TimeoutError } from "../src/errors.js";
import { PollingManager } from "../src/runtime/polling.js";
import { createAsset, createJob } from "./fixtures/factories.js";

describe("PollingManager", () => {
  it("waits until a job reaches a terminal status", async () => {
    const refresher = {
      refreshJob: vi
        .fn()
        .mockResolvedValueOnce({ job: createJob("queued"), assets: [] })
        .mockResolvedValueOnce({ job: createJob("running"), assets: [] })
        .mockResolvedValueOnce({ job: createJob("succeeded"), assets: [createAsset()] }),
    };
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const polling = new PollingManager(refresher, logger, 0);

    const result = await polling.waitForJob("job_test", {
      pollIntervalMs: 0,
      maxAttempts: 5,
    });

    expect(result.job.status).toBe("succeeded");
    expect(result.assets).toHaveLength(1);
    expect(result.attempts).toBe(3);
  });

  it("throws a timeout error after max attempts", async () => {
    const refresher = {
      refreshJob: vi.fn().mockResolvedValue({ job: createJob("queued"), assets: [] }),
    };
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const polling = new PollingManager(refresher, logger, 0);

    await expect(
      polling.waitForJob("job_test", {
        pollIntervalMs: 0,
        maxAttempts: 2,
      }),
    ).rejects.toBeInstanceOf(TimeoutError);
  });
});
