import type {
  GeneratedMediaType,
  GenerateStoryboardSequenceInput,
  OpenClawToolDefinition,
  RunwayToolContext,
  StoryboardShotInput,
} from "../types.js";
import {
  readArray,
  readOptionalEnum,
  readOptionalNumber,
  readOptionalString,
  readOptionalStringArray,
  readRecord,
  readString,
} from "../utils/guards.js";

const MEDIA_TYPES = ["image", "video"] as const satisfies readonly GeneratedMediaType[];

function parseStoryboardShot(value: unknown, label: string): StoryboardShotInput {
  const record = readRecord(value, label);
  const parsed: StoryboardShotInput = {
    prompt: readString(record.prompt, `${label}.prompt`),
  };

  const stringFields = [
    "title",
    "negativePrompt",
    "framing",
    "shotType",
    "cameraLanguage",
    "cameraMotion",
    "lighting",
    "mood",
    "environment",
  ] as const;

  for (const field of stringFields) {
    const value = readOptionalString(record[field], `${label}.${field}`);

    if (value !== undefined) {
      parsed[field] = value;
    }
  }

  const mediaType = readOptionalEnum(record.mediaType, `${label}.mediaType`, MEDIA_TYPES);
  const durationSeconds = readOptionalNumber(
    record.durationSeconds,
    `${label}.durationSeconds`,
  );
  const fps = readOptionalNumber(record.fps, `${label}.fps`);
  const variants = readOptionalNumber(record.variants, `${label}.variants`);
  const seed = readOptionalNumber(record.seed, `${label}.seed`);
  const continuityNotes = readOptionalStringArray(
    record.continuityNotes,
    `${label}.continuityNotes`,
  );

  if (mediaType !== undefined) {
    parsed.mediaType = mediaType;
  }

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

  if (continuityNotes !== undefined) {
    parsed.continuityNotes = continuityNotes;
  }

  return parsed;
}

function parseGenerateStoryboardSequenceInput(
  input: unknown,
): GenerateStoryboardSequenceInput {
  const record = readRecord(input, "generate_storyboard_sequence input");
  const parsed: GenerateStoryboardSequenceInput = {
    characterId: readString(record.characterId, "characterId"),
    shots: readArray(record.shots, "shots", (item, index) =>
      parseStoryboardShot(item, `shots[${index}]`),
    ),
  };

  const sequenceName = readOptionalString(record.sequenceName, "sequenceName");
  const aspectRatio = readOptionalString(record.aspectRatio, "aspectRatio");
  const commonContinuityNotes = readOptionalStringArray(
    record.commonContinuityNotes,
    "commonContinuityNotes",
  );

  if (sequenceName !== undefined) {
    parsed.sequenceName = sequenceName;
  }

  if (aspectRatio !== undefined) {
    parsed.aspectRatio = aspectRatio;
  }

  if (commonContinuityNotes !== undefined) {
    parsed.commonContinuityNotes = commonContinuityNotes;
  }

  return parsed;
}

export function generateStoryboardSequenceTool(
  context: RunwayToolContext,
): OpenClawToolDefinition<GenerateStoryboardSequenceInput> {
  return {
    name: "generate_storyboard_sequence",
    description:
      "Submit a related multi-shot storyboard workflow for a single character with continuity tracking.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["characterId", "shots"],
      properties: {
        characterId: { type: "string" },
        sequenceName: { type: "string" },
        aspectRatio: { type: "string" },
        commonContinuityNotes: { type: "array", items: { type: "string" } },
        shots: {
          type: "array",
          items: {
            type: "object",
            required: ["prompt"],
            properties: {
              title: { type: "string" },
              mediaType: { type: "string", enum: [...MEDIA_TYPES] },
              prompt: { type: "string" },
              negativePrompt: { type: "string" },
              framing: { type: "string" },
              shotType: { type: "string" },
              cameraLanguage: { type: "string" },
              cameraMotion: { type: "string" },
              lighting: { type: "string" },
              mood: { type: "string" },
              environment: { type: "string" },
              durationSeconds: { type: "number" },
              fps: { type: "number" },
              continuityNotes: { type: "array", items: { type: "string" } },
              variants: { type: "number" },
              seed: { type: "number" },
            },
          },
        },
      },
    },
    parse: parseGenerateStoryboardSequenceInput,
    handler: async (input) => context.generateStoryboardSequence(input),
  };
}
