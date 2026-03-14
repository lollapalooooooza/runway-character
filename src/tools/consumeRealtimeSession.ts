import type {
  ConsumeRealtimeSessionInput,
  OpenClawToolDefinition,
  RunwayToolContext,
} from "../types.js";
import { readRecord, readString } from "../utils/guards.js";

function parseConsumeRealtimeSessionInput(input: unknown): ConsumeRealtimeSessionInput {
  const record = readRecord(input, "consume_realtime_session input");
  return { sessionId: readString(record.sessionId, "sessionId") };
}

export function consumeRealtimeSessionTool(
  context: RunwayToolContext,
): OpenClawToolDefinition<ConsumeRealtimeSessionInput> {
  return {
    name: "consume_realtime_session",
    description: "Consume a READY realtime session and return connection credentials.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["sessionId"],
      properties: { sessionId: { type: "string" } },
    },
    parse: parseConsumeRealtimeSessionInput,
    handler: async (input) => context.consumeRealtimeSession(input),
  };
}
