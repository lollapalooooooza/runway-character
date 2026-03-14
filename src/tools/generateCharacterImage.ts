import type {
  GenerateCharacterImageInput,
  OpenClawToolDefinition,
  RunwayToolContext,
} from "../types.js";
import {
  readOptionalNumber,
  readOptionalString,
  readOptionalStringArray,
  readRecord,
  readString,
} from "../utils/guards.js";

function parseGenerateCharacterImageInput(input: unknown): GenerateCharacterImageInput {
  const record = readRecord(input, "generate_character_image input");
  const parsed: GenerateCharacterImageInput = {
    characterId: readString(record.characterId, "characterId"),
    prompt: readString(record.prompt, "prompt"),
  };

  const stringFields = [
    "negativePrompt",
    "aspectRatio",
    "framing",
    "cameraLanguage",
    "lens",
    "lighting",
    "mood",
    "environment",
    "shotLabel",
  ] as const;

  for (const field of stringFields) {
    const value = readOptionalString(record[field], field);

    if (value !== undefined) {
      parsed[field] = value;
    }
  }

  const referenceStrength = readOptionalNumber(record.referenceStrength, "referenceStrength");
  const variants = readOptionalNumber(record.variants, "variants");
  const seed = readOptionalNumber(record.seed, "seed");
  const consistencyHints = readOptionalStringArray(
    record.consistencyHints,
    "consistencyHints",
  );

  if (referenceStrength !== undefined) {
    parsed.referenceStrength = referenceStrength;
  }

  if (variants !== undefined) {
    parsed.variants = variants;
  }

  if (seed !== undefined) {
    parsed.seed = seed;
  }

  if (consistencyHints !== undefined) {
    parsed.consistencyHints = consistencyHints;
  }

  return parsed;
}

export function generateCharacterImageTool(
  context: RunwayToolContext,
): OpenClawToolDefinition<GenerateCharacterImageInput> {
  return {
    name: "generate_character_image",
    description: "Submit a still image generation job for a specific character profile.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["characterId", "prompt"],
      properties: {
        characterId: { type: "string" },
        prompt: { type: "string" },
        negativePrompt: { type: "string" },
        aspectRatio: { type: "string" },
        framing: { type: "string" },
        cameraLanguage: { type: "string" },
        lens: { type: "string" },
        lighting: { type: "string" },
        mood: { type: "string" },
        environment: { type: "string" },
        referenceStrength: { type: "number" },
        consistencyHints: { type: "array", items: { type: "string" } },
        variants: { type: "number" },
        seed: { type: "number" },
        shotLabel: { type: "string" },
      },
    },
    parse: parseGenerateCharacterImageInput,
    handler: async (input) => context.generateCharacterImage(input),
  };
}
