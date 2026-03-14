import type {
  GetCharacterProfileInput,
  OpenClawToolDefinition,
  RunwayToolContext,
} from "../types.js";
import { readRecord, readString } from "../utils/guards.js";

function parseGetCharacterProfileInput(input: unknown): GetCharacterProfileInput {
  const record = readRecord(input, "get_character_profile input");

  return {
    characterId: readString(record.characterId, "characterId"),
  };
}

export function getCharacterProfileTool(
  context: RunwayToolContext,
): OpenClawToolDefinition<GetCharacterProfileInput> {
  return {
    name: "get_character_profile",
    description: "Fetch an existing character profile by id.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["characterId"],
      properties: {
        characterId: { type: "string" },
      },
    },
    parse: parseGetCharacterProfileInput,
    handler: async (input) => context.getCharacterProfile(input),
  };
}
