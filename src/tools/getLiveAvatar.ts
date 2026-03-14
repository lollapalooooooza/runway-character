import type {
  GetLiveAvatarInput,
  OpenClawToolDefinition,
  RunwayToolContext,
} from "../types.js";
import { readRecord, readString } from "../utils/guards.js";

function parseGetLiveAvatarInput(input: unknown): GetLiveAvatarInput {
  const record = readRecord(input, "get_live_avatar input");
  return { avatarId: readString(record.avatarId, "avatarId") };
}

export function getLiveAvatarTool(
  context: RunwayToolContext,
): OpenClawToolDefinition<GetLiveAvatarInput> {
  return {
    name: "get_live_avatar",
    description: "Fetch a Runway live avatar by id.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["avatarId"],
      properties: { avatarId: { type: "string" } },
    },
    parse: parseGetLiveAvatarInput,
    handler: async (input) => context.getLiveAvatar(input),
  };
}
