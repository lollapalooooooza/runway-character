import type {
  CreateLiveAvatarInput,
  OpenClawToolDefinition,
  RunwayToolContext,
} from "../types.js";
import { readRecord, readString } from "../utils/guards.js";

function parseCreateLiveAvatarInput(input: unknown): CreateLiveAvatarInput {
  const record = readRecord(input, "create_live_avatar input");
  const readOptionalString = (value: unknown) =>
    value === undefined ? undefined : readString(value, "optional string");

  return {
    name: readString(record.name, "name"),
    referenceImage: readString(record.referenceImage, "referenceImage"),
    personality: readString(record.personality, "personality"),
    voicePresetId: readString(record.voicePresetId, "voicePresetId"),
    ...(record.startScript !== undefined
      ? { startScript: readOptionalString(record.startScript) }
      : {}),
  };
}

export function createLiveAvatarTool(
  context: RunwayToolContext,
): OpenClawToolDefinition<CreateLiveAvatarInput> {
  return {
    name: "create_live_avatar",
    description: "Create a Runway live avatar for realtime video calls.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["name", "referenceImage", "personality", "voicePresetId"],
      properties: {
        name: { type: "string" },
        referenceImage: { type: "string" },
        personality: { type: "string" },
        voicePresetId: { type: "string" },
        startScript: { type: "string" },
      },
    },
    parse: parseCreateLiveAvatarInput,
    handler: async (input) => context.createLiveAvatar(input),
  };
}
