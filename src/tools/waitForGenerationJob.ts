import type {
  OpenClawToolDefinition,
  RunwayToolContext,
  WaitForGenerationJobInput,
} from "../types.js";
import {
  readOptionalNumber,
  readRecord,
  readString,
} from "../utils/guards.js";

function parseWaitForGenerationJobInput(input: unknown): WaitForGenerationJobInput {
  const record = readRecord(input, "wait_for_generation_job input");
  const parsed: WaitForGenerationJobInput = {
    jobId: readString(record.jobId, "jobId"),
  };

  const pollIntervalMs = readOptionalNumber(record.pollIntervalMs, "pollIntervalMs");
  const timeoutMs = readOptionalNumber(record.timeoutMs, "timeoutMs");
  const maxAttempts = readOptionalNumber(record.maxAttempts, "maxAttempts");

  if (pollIntervalMs !== undefined) {
    parsed.pollIntervalMs = pollIntervalMs;
  }

  if (timeoutMs !== undefined) {
    parsed.timeoutMs = timeoutMs;
  }

  if (maxAttempts !== undefined) {
    parsed.maxAttempts = maxAttempts;
  }

  return parsed;
}

export function waitForGenerationJobTool(
  context: RunwayToolContext,
): OpenClawToolDefinition<WaitForGenerationJobInput> {
  return {
    name: "wait_for_generation_job",
    description: "Poll a generation job until it reaches a terminal state.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["jobId"],
      properties: {
        jobId: { type: "string" },
        pollIntervalMs: { type: "number" },
        timeoutMs: { type: "number" },
        maxAttempts: { type: "number" },
      },
    },
    parse: parseWaitForGenerationJobInput,
    handler: async (input) => context.waitForGenerationJob(input),
  };
}
