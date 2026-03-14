import type {
  CharacterReferenceRole,
  CharacterReferenceSourceType,
  CreateCharacterProfileInput,
  CreateCharacterReferenceImageInput,
  OpenClawToolDefinition,
  RunwayToolContext,
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

const SOURCE_TYPES = ["upload", "url", "local"] as const satisfies readonly CharacterReferenceSourceType[];
const REFERENCE_ROLES = [
  "primary",
  "secondary",
  "expression",
  "wardrobe",
  "pose",
  "motion",
] as const satisfies readonly CharacterReferenceRole[];

function parseReferenceImage(
  value: unknown,
  label: string,
): CreateCharacterReferenceImageInput {
  const record = readRecord(value, label);
  const parsed: CreateCharacterReferenceImageInput = {
    sourceType: readOptionalEnum(
      record.sourceType,
      `${label}.sourceType`,
      SOURCE_TYPES,
    ) ?? "url",
    source: readString(record.source, `${label}.source`),
  };

  const labelValue = readOptionalString(record.label, `${label}.label`);
  const role = readOptionalEnum(record.role, `${label}.role`, REFERENCE_ROLES);
  const notes = readOptionalString(record.notes, `${label}.notes`);
  const weight = readOptionalNumber(record.weight, `${label}.weight`);

  if (labelValue !== undefined) {
    parsed.label = labelValue;
  }

  if (role !== undefined) {
    parsed.role = role;
  }

  if (notes !== undefined) {
    parsed.notes = notes;
  }

  if (weight !== undefined) {
    parsed.weight = weight;
  }

  return parsed;
}

function parseCreateCharacterProfileInput(input: unknown): CreateCharacterProfileInput {
  const record = readRecord(input, "create_character_profile input");
  const parsed: CreateCharacterProfileInput = {
    name: readString(record.name, "name"),
  };

  const optionalStrings = [
    "description",
    "visualSummary",
    "ageRange",
    "genderPresentation",
    "ethnicityOrAppearanceNotes",
    "hair",
    "face",
    "bodyType",
    "personality",
    "voiceNotes",
    "cinematicUniverse",
    "mood",
    "visualLanguage",
  ] as const;

  for (const field of optionalStrings) {
    const value = readOptionalString(record[field], field);

    if (value !== undefined) {
      parsed[field] = value;
    }
  }

  const wardrobe = readOptionalStringArray(record.wardrobe, "wardrobe");
  const accessories = readOptionalStringArray(record.accessories, "accessories");
  const styleTags = readOptionalStringArray(record.styleTags, "styleTags");
  const consistencyRules = readOptionalStringArray(
    record.consistencyRules,
    "consistencyRules",
  );
  const continuityNotes = readOptionalStringArray(
    record.continuityNotes,
    "continuityNotes",
  );

  if (wardrobe !== undefined) {
    parsed.wardrobe = wardrobe;
  }

  if (accessories !== undefined) {
    parsed.accessories = accessories;
  }

  if (styleTags !== undefined) {
    parsed.styleTags = styleTags;
  }

  if (consistencyRules !== undefined) {
    parsed.consistencyRules = consistencyRules;
  }

  if (continuityNotes !== undefined) {
    parsed.continuityNotes = continuityNotes;
  }

  if (record.referenceImages !== undefined) {
    parsed.referenceImages = readArray(
      record.referenceImages,
      "referenceImages",
      (item, index) => parseReferenceImage(item, `referenceImages[${index}]`),
    );
  }

  return parsed;
}

export function createCharacterProfileTool(
  context: RunwayToolContext,
): OpenClawToolDefinition<CreateCharacterProfileInput> {
  return {
    name: "create_character_profile",
    description: "Create a reusable character profile with references and continuity metadata.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["name"],
      properties: {
        name: { type: "string", description: "Character name." },
        description: { type: "string" },
        visualSummary: { type: "string" },
        ageRange: { type: "string" },
        genderPresentation: { type: "string" },
        ethnicityOrAppearanceNotes: { type: "string" },
        hair: { type: "string" },
        face: { type: "string" },
        bodyType: { type: "string" },
        wardrobe: { type: "array", items: { type: "string" } },
        accessories: { type: "array", items: { type: "string" } },
        personality: { type: "string" },
        voiceNotes: { type: "string" },
        styleTags: { type: "array", items: { type: "string" } },
        cinematicUniverse: { type: "string" },
        mood: { type: "string" },
        visualLanguage: { type: "string" },
        consistencyRules: { type: "array", items: { type: "string" } },
        continuityNotes: { type: "array", items: { type: "string" } },
        referenceImages: {
          type: "array",
          items: {
            type: "object",
            required: ["sourceType", "source"],
            properties: {
              sourceType: { type: "string", enum: [...SOURCE_TYPES] },
              source: { type: "string" },
              label: { type: "string" },
              role: { type: "string", enum: [...REFERENCE_ROLES] },
              notes: { type: "string" },
              weight: { type: "number" },
            },
          },
        },
      },
    },
    parse: parseCreateCharacterProfileInput,
    handler: async (input) => context.createCharacterProfile(input),
  };
}
