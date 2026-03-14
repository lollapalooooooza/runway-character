import type {
  CharacterReferenceRole,
  CharacterReferenceSourceType,
  EditableCharacterProfileFields,
  OpenClawToolDefinition,
  RunwayToolContext,
  UpdateCharacterProfileInput,
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

function parseMetadataPatch(
  value: unknown,
  label: string,
): EditableCharacterProfileFields {
  const record = readRecord(value, label);
  const parsed: EditableCharacterProfileFields = {};

  const stringFields = [
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

  for (const field of stringFields) {
    const fieldValue = readOptionalString(record[field], `${label}.${field}`);

    if (fieldValue !== undefined) {
      parsed[field] = fieldValue;
    }
  }

  const arrayFields = [
    "wardrobe",
    "accessories",
    "styleTags",
    "consistencyRules",
  ] as const;

  for (const field of arrayFields) {
    const fieldValue = readOptionalStringArray(record[field], `${label}.${field}`);

    if (fieldValue !== undefined) {
      parsed[field] = fieldValue;
    }
  }

  return parsed;
}

function parseReferenceImage(value: unknown, label: string) {
  const record = readRecord(value, label);
  const parsed = {
    sourceType:
      readOptionalEnum(record.sourceType, `${label}.sourceType`, SOURCE_TYPES) ??
      "url",
    source: readString(record.source, `${label}.source`),
  };
  const labelValue = readOptionalString(record.label, `${label}.label`);
  const role = readOptionalEnum(record.role, `${label}.role`, REFERENCE_ROLES);
  const notes = readOptionalString(record.notes, `${label}.notes`);
  const weight = readOptionalNumber(record.weight, `${label}.weight`);

  return {
    ...parsed,
    ...(labelValue !== undefined ? { label: labelValue } : {}),
    ...(role !== undefined ? { role } : {}),
    ...(notes !== undefined ? { notes } : {}),
    ...(weight !== undefined ? { weight } : {}),
  };
}

function parseUpdateCharacterProfileInput(input: unknown): UpdateCharacterProfileInput {
  const record = readRecord(input, "update_character_profile input");
  const parsed: UpdateCharacterProfileInput = {
    characterId: readString(record.characterId, "characterId"),
  };

  if (record.metadata !== undefined) {
    parsed.metadata = parseMetadataPatch(record.metadata, "metadata");
  }

  if (record.addReferenceImages !== undefined) {
    parsed.addReferenceImages = readArray(
      record.addReferenceImages,
      "addReferenceImages",
      (item, index) => parseReferenceImage(item, `addReferenceImages[${index}]`),
    );
  }

  const removeReferenceImageIds = readOptionalStringArray(
    record.removeReferenceImageIds,
    "removeReferenceImageIds",
  );
  const continuityNotesToAdd = readOptionalStringArray(
    record.continuityNotesToAdd,
    "continuityNotesToAdd",
  );
  const continuityNote = readOptionalString(record.continuityNote, "continuityNote");

  if (removeReferenceImageIds !== undefined) {
    parsed.removeReferenceImageIds = removeReferenceImageIds;
  }

  if (continuityNotesToAdd !== undefined) {
    parsed.continuityNotesToAdd = continuityNotesToAdd;
  }

  if (continuityNote !== undefined) {
    parsed.continuityNote = continuityNote;
  }

  if (record.styleConstraints !== undefined) {
    const styleRecord = readRecord(record.styleConstraints, "styleConstraints");
    parsed.styleConstraints = {};

    const styleTags = readOptionalStringArray(styleRecord.styleTags, "styleConstraints.styleTags");
    const consistencyRules = readOptionalStringArray(
      styleRecord.consistencyRules,
      "styleConstraints.consistencyRules",
    );
    const cinematicUniverse = readOptionalString(
      styleRecord.cinematicUniverse,
      "styleConstraints.cinematicUniverse",
    );
    const mood = readOptionalString(styleRecord.mood, "styleConstraints.mood");
    const visualLanguage = readOptionalString(
      styleRecord.visualLanguage,
      "styleConstraints.visualLanguage",
    );

    if (styleTags !== undefined) {
      parsed.styleConstraints.styleTags = styleTags;
    }

    if (consistencyRules !== undefined) {
      parsed.styleConstraints.consistencyRules = consistencyRules;
    }

    if (cinematicUniverse !== undefined) {
      parsed.styleConstraints.cinematicUniverse = cinematicUniverse;
    }

    if (mood !== undefined) {
      parsed.styleConstraints.mood = mood;
    }

    if (visualLanguage !== undefined) {
      parsed.styleConstraints.visualLanguage = visualLanguage;
    }
  }

  return parsed;
}

export function updateCharacterProfileTool(
  context: RunwayToolContext,
): OpenClawToolDefinition<UpdateCharacterProfileInput> {
  return {
    name: "update_character_profile",
    description:
      "Update character metadata, reference images, style constraints, and continuity notes.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["characterId"],
      properties: {
        characterId: { type: "string" },
        metadata: { type: "object" },
        addReferenceImages: { type: "array", items: { type: "object" } },
        removeReferenceImageIds: { type: "array", items: { type: "string" } },
        styleConstraints: { type: "object" },
        continuityNote: { type: "string" },
        continuityNotesToAdd: { type: "array", items: { type: "string" } },
      },
    },
    parse: parseUpdateCharacterProfileInput,
    handler: async (input) => context.updateCharacterProfile(input),
  };
}
