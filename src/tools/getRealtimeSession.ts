import type {
  GetRealtimeSessionInput,
  OpenClawToolDefinition,
  RunwayToolContext,
} from "../types.js";
import { readRecord, readString } from "../utils/guards.js";

function parseGetRealtimeSessionInput(input: unknown): GetRealtimeSessionInput {
  const record = readRecord(input, "get_realtime_session input");
  return { sessionId: readString(record.sessionId, "sessionId") };
}

export function getRealtimeSessionTool(
  context: RunwayToolContext,
): OpenClawToolDefinition<GetRealtimeSessionInput> {
  return {
    name: "get_realtime_session",
    description: "Fetch a realtime session by id.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["sessionId"],
      properties: { sessionId: { type: "string" } },
    },
    parse: parseGetRealtimeSessionInput,
    handler: async (input) => context.getRealtimeSession(input),
  };
}
