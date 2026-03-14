import type {
  OpenClawToolDefinition,
  RunwayToolContext,
  WaitForRealtimeSessionInput,
} from "../types.js";
import { readNumber, readRecord, readString } from "../utils/guards.js";

function parseWaitForRealtimeSessionInput(input: unknown): WaitForRealtimeSessionInput {
  const record = readRecord(input, "wait_for_realtime_session input");
  return {
    sessionId: readString(record.sessionId, "sessionId"),
    ...(record.timeoutMs !== undefined ? { timeoutMs: readNumber(record.timeoutMs, "timeoutMs") } : {}),
    ...(record.pollIntervalMs !== undefined ? { pollIntervalMs: readNumber(record.pollIntervalMs, "pollIntervalMs") } : {}),
    ...(record.maxAttempts !== undefined ? { maxAttempts: readNumber(record.maxAttempts, "maxAttempts") } : {}),
  };
}

export function waitForRealtimeSessionTool(
  context: RunwayToolContext,
): OpenClawToolDefinition<WaitForRealtimeSessionInput> {
  return {
    name: "wait_for_realtime_session",
    description: "Poll a realtime session until it is READY or terminal.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["sessionId"],
      properties: {
        sessionId: { type: "string" },
        timeoutMs: { type: "number" },
        pollIntervalMs: { type: "number" },
        maxAttempts: { type: "number" },
      },
    },
    parse: parseWaitForRealtimeSessionInput,
    handler: async (input) => context.waitForRealtimeSession(input),
  };
}
