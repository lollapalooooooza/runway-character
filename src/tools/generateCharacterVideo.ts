import type {
  GenerateCharacterVideoInput,
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

function parseGenerateCharacterVideoInput(input: unknown): GenerateCharacterVideoInput {
  const record = readRecord(input, "generate_character_video input");
  const parsed: GenerateCharacterVideoInput = {
    characterId: readString(record.characterId, "characterId"),
    scenePrompt: readString(record.scenePrompt, "scenePrompt"),
  };

  const stringFields = [
    "motionPrompt",
    "negativePrompt",
    "shotType",
    "cameraMotion",
    "cameraLanguage",
    "aspectRatio",
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

  const durationSeconds = readOptionalNumber(record.durationSeconds, "durationSeconds");
  const fps = readOptionalNumber(record.fps, "fps");
  const variants = readOptionalNumber(record.variants, "variants");
  const seed = readOptionalNumber(record.seed, "seed");
  const continuityConstraints = readOptionalStringArray(
    record.continuityConstraints,
    "continuityConstraints",
  );

  if (durationSeconds !== undefined) {
    parsed.durationSeconds = durationSeconds;
  }

  if (fps !== undefined) {
    parsed.fps = fps;
  }

  if (variants !== undefined) {
    parsed.variants = variants;
  }

  if (seed !== undefined) {
    parsed.seed = seed;
  }

  if (continuityConstraints !== undefined) {
    parsed.continuityConstraints = continuityConstraints;
  }

  return parsed;
}

export function generateCharacterVideoTool(
  context: RunwayToolContext,
): OpenClawToolDefinition<GenerateCharacterVideoInput> {
  return {
    name: "generate_character_video",
    description: "Submit an asynchronous motion generation job for a character profile.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["characterId", "scenePrompt"],
      properties: {
        characterId: { type: "string" },
        scenePrompt: { type: "string" },
        motionPrompt: { type: "string" },
        negativePrompt: { type: "string" },
        shotType: { type: "string" },
        cameraMotion: { type: "string" },
        cameraLanguage: { type: "string" },
        durationSeconds: { type: "number" },
        fps: { type: "number" },
        aspectRatio: { type: "string" },
        lighting: { type: "string" },
        mood: { type: "string" },
        environment: { type: "string" },
        continuityConstraints: { type: "array", items: { type: "string" } },
        variants: { type: "number" },
        seed: { type: "number" },
        shotLabel: { type: "string" },
      },
    },
    parse: parseGenerateCharacterVideoInput,
    handler: async (input) => context.generateCharacterVideo(input),
  };
}
