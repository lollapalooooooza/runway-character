import type {
  GeneratedMediaType,
  ListCharacterAssetsInput,
  OpenClawToolDefinition,
  RunwayToolContext,
} from "../types.js";
import {
  readOptionalEnum,
  readOptionalNumber,
  readRecord,
  readString,
} from "../utils/guards.js";

const MEDIA_TYPES = ["image", "video"] as const satisfies readonly GeneratedMediaType[];

function parseListCharacterAssetsInput(input: unknown): ListCharacterAssetsInput {
  const record = readRecord(input, "list_character_assets input");
  const parsed: ListCharacterAssetsInput = {
    characterId: readString(record.characterId, "characterId"),
  };

  const mediaType = readOptionalEnum(record.mediaType, "mediaType", MEDIA_TYPES);
  const limit = readOptionalNumber(record.limit, "limit");

  if (mediaType !== undefined) {
    parsed.mediaType = mediaType;
  }

  if (limit !== undefined) {
    parsed.limit = limit;
  }

  return parsed;
}

export function listCharacterAssetsTool(
  context: RunwayToolContext,
): OpenClawToolDefinition<ListCharacterAssetsInput> {
  return {
    name: "list_character_assets",
    description: "List normalized generated assets for a character profile.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["characterId"],
      properties: {
        characterId: { type: "string" },
        mediaType: { type: "string", enum: [...MEDIA_TYPES] },
        limit: { type: "number" },
      },
    },
    parse: parseListCharacterAssetsInput,
    handler: async (input) => context.listCharacterAssets(input),
  };
}
