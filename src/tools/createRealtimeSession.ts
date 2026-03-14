import type {
  CreateRealtimeSessionInput,
  OpenClawToolDefinition,
  RunwayToolContext,
} from "../types.js";
import { readRecord, readString } from "../utils/guards.js";

function parseCreateRealtimeSessionInput(input: unknown): CreateRealtimeSessionInput {
  const record = readRecord(input, "create_realtime_session input");
  return { avatarId: readString(record.avatarId, "avatarId") };
}

export function createRealtimeSessionTool(
  context: RunwayToolContext,
): OpenClawToolDefinition<CreateRealtimeSessionInput> {
  return {
    name: "create_realtime_session",
    description: "Create a realtime session for a live avatar call.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["avatarId"],
      properties: { avatarId: { type: "string" } },
    },
    parse: parseCreateRealtimeSessionInput,
    handler: async (input) => context.createRealtimeSession(input),
  };
}
