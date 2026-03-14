import { MappingError } from "../errors.js";
import type {
  CharacterProfile,
  CharacterReferenceImage,
  CreateCharacterProfileInput,
  CreateCharacterReferenceImageInput,
  EditableCharacterProfileFields,
  GenerateCharacterImageInput,
  GenerateCharacterVideoInput,
  GenerateStoryboardSequenceInput,
  GenerationJob,
  GeneratedMediaType,
  PromptSnapshot,
  RunwayAdapterConfig,
  RunwayCreateGenerationJobRequest,
  StoryboardShot,
  StoryboardShotInput,
  UpdateCharacterProfileInput,
} from "../types.js";
import { createId, createOutputName, slugify } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";

function buildReferenceImage(
  characterId: string,
  input: CreateCharacterReferenceImageInput,
  timestamp: string,
): CharacterReferenceImage {
  return {
    id: createId("ref"),
    characterId,
    sourceType: input.sourceType,
    source: input.source,
    role: input.role ?? "secondary",
    weight: input.weight ?? 1,
    createdAt: timestamp,
    ...(input.label !== undefined ? { label: input.label } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  };
}

function buildEditableFieldsPatch(
  profile: CharacterProfile,
  metadata?: EditableCharacterProfileFields,
): CharacterProfile {
  if (!metadata) {
    return profile;
  }

  const next = { ...profile };

  for (const [key, value] of Object.entries(metadata)) {
    if (value !== undefined) {
      (next as Record<string, unknown>)[key] = Array.isArray(value)
        ? [...value]
        : value;
    }
  }

  return next;
}

function buildContinuityInstructions(
  profile: CharacterProfile,
  extraHints: string[],
): string[] {
  const notes = profile.continuityNotes.slice(-3).map((entry) => entry.note);
  const instructions = [
    `Preserve the identity of ${profile.name}.`,
    profile.visualSummary
      ? `Visual identity: ${profile.visualSummary}.`
      : undefined,
    profile.ethnicityOrAppearanceNotes
      ? `Appearance notes: ${profile.ethnicityOrAppearanceNotes}.`
      : undefined,
    profile.hair ? `Hair: ${profile.hair}.` : undefined,
    profile.face ? `Face: ${profile.face}.` : undefined,
    profile.bodyType ? `Body type: ${profile.bodyType}.` : undefined,
    profile.wardrobe.length > 0
      ? `Wardrobe anchors: ${profile.wardrobe.join(", ")}.`
      : undefined,
    profile.accessories.length > 0
      ? `Accessories: ${profile.accessories.join(", ")}.`
      : undefined,
    profile.styleTags.length > 0
      ? `Style tags: ${profile.styleTags.join(", ")}.`
      : undefined,
    profile.visualLanguage
      ? `Visual language: ${profile.visualLanguage}.`
      : undefined,
    profile.cinematicUniverse
      ? `Cinematic universe: ${profile.cinematicUniverse}.`
      : undefined,
    profile.consistencyRules.length > 0
      ? `Consistency rules: ${profile.consistencyRules.join("; ")}.`
      : undefined,
    notes.length > 0 ? `Continuity notes: ${notes.join(" | ")}.` : undefined,
    ...extraHints.map((hint) => `Additional continuity hint: ${hint}.`),
  ];

  return instructions.filter((entry): entry is string => entry !== undefined);
}

function buildReferenceAssets(
  profile: CharacterProfile,
  referenceStrength?: number,
): RunwayCreateGenerationJobRequest["input"]["references"] {
  return profile.referenceImages.map((image) => ({
    source: image.uploadedUri ?? image.source,
    sourceType: image.uploadedUri ? "url" : image.sourceType,
    role: image.role,
    weight: referenceStrength ?? image.weight,
    ...(image.label !== undefined ? { label: image.label } : {}),
    ...(image.notes !== undefined ? { notes: image.notes } : {}),
    ...(image.providerAssetId !== undefined ? { remoteAssetId: image.providerAssetId } : {}),
  }));
}

function createJobDraft(
  characterId: string,
  mediaType: GeneratedMediaType,
  promptSnapshot: PromptSnapshot,
  request: RunwayCreateGenerationJobRequest,
  continuityBundleId?: string,
): GenerationJob {
  const timestamp = nowIso();

  return {
    id: createId("job"),
    characterId,
    mediaType,
    status: "queued",
    promptSnapshot,
    request,
    outputAssetIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    submittedAt: timestamp,
    ...(continuityBundleId !== undefined
      ? { continuityBundleId }
      : {}),
  };
}

function composePrompt(
  userPrompt: string,
  fields: {
    framing?: string;
    cameraLanguage?: string;
    lens?: string;
    lighting?: string;
    mood?: string;
    environment?: string;
    motionPrompt?: string;
    shotType?: string;
    cameraMotion?: string;
    continuityInstructions: string[];
  },
): string {
  // The provider-facing prompt is intentionally richer than the raw tool input because
  // the remote workflow may only expose prompt + references for character continuity.
  const sections = [
    userPrompt,
    fields.framing ? `Framing: ${fields.framing}.` : undefined,
    fields.cameraLanguage ? `Camera language: ${fields.cameraLanguage}.` : undefined,
    fields.lens ? `Lens: ${fields.lens}.` : undefined,
    fields.lighting ? `Lighting: ${fields.lighting}.` : undefined,
    fields.mood ? `Mood: ${fields.mood}.` : undefined,
    fields.environment ? `Environment: ${fields.environment}.` : undefined,
    fields.shotType ? `Shot type: ${fields.shotType}.` : undefined,
    fields.cameraMotion ? `Camera motion: ${fields.cameraMotion}.` : undefined,
    fields.motionPrompt ? `Motion direction: ${fields.motionPrompt}.` : undefined,
    `Character continuity: ${fields.continuityInstructions.join(" ")}`,
  ];

  return sections.filter((entry): entry is string => entry !== undefined).join("\n");
}

export function mapCreateCharacterProfileInput(
  input: CreateCharacterProfileInput,
): CharacterProfile {
  const timestamp = nowIso();
  const characterId = createId("char");
  const profile: CharacterProfile = {
    id: characterId,
    name: input.name,
    slug: slugify(input.name),
    wardrobe: [...(input.wardrobe ?? [])],
    accessories: [...(input.accessories ?? [])],
    styleTags: [...(input.styleTags ?? [])],
    consistencyRules: [...(input.consistencyRules ?? [])],
    referenceImages: (input.referenceImages ?? []).map((image) =>
      buildReferenceImage(characterId, image, timestamp),
    ),
    continuityNotes: (input.continuityNotes ?? []).map((note) => ({
      id: createId("continuity"),
      note,
      createdAt: timestamp,
    })),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const optionalFields: Array<keyof Omit<
    CharacterProfile,
    | "id"
    | "name"
    | "slug"
    | "wardrobe"
    | "accessories"
    | "styleTags"
    | "consistencyRules"
    | "referenceImages"
    | "continuityNotes"
    | "createdAt"
    | "updatedAt"
  >> = [
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
  ];

  for (const key of optionalFields) {
    const value = input[key];

    if (value !== undefined) {
      (profile as unknown as Record<string, unknown>)[key] = value;
    }
  }

  return profile;
}

export function applyCharacterProfileUpdate(
  profile: CharacterProfile,
  input: UpdateCharacterProfileInput,
): CharacterProfile {
  const timestamp = nowIso();
  const next = buildEditableFieldsPatch(profile, input.metadata);

  if (input.styleConstraints) {
    if (input.styleConstraints.styleTags !== undefined) {
      next.styleTags = [...input.styleConstraints.styleTags];
    }

    if (input.styleConstraints.consistencyRules !== undefined) {
      next.consistencyRules = [...input.styleConstraints.consistencyRules];
    }

    if (input.styleConstraints.cinematicUniverse !== undefined) {
      next.cinematicUniverse = input.styleConstraints.cinematicUniverse;
    }

    if (input.styleConstraints.mood !== undefined) {
      next.mood = input.styleConstraints.mood;
    }

    if (input.styleConstraints.visualLanguage !== undefined) {
      next.visualLanguage = input.styleConstraints.visualLanguage;
    }
  }

  if (input.addReferenceImages && input.addReferenceImages.length > 0) {
    next.referenceImages = [
      ...next.referenceImages,
      ...input.addReferenceImages.map((image) =>
        buildReferenceImage(profile.id, image, timestamp),
      ),
    ];
  }

  if (input.removeReferenceImageIds && input.removeReferenceImageIds.length > 0) {
    const toRemove = new Set(input.removeReferenceImageIds);
    next.referenceImages = next.referenceImages.filter((image) => !toRemove.has(image.id));
  }

  const notesToAdd = [
    ...(input.continuityNote ? [input.continuityNote] : []),
    ...(input.continuityNotesToAdd ?? []),
  ];

  if (notesToAdd.length > 0) {
    next.continuityNotes = [
      ...next.continuityNotes,
      ...notesToAdd.map((note) => ({
        id: createId("continuity"),
        note,
        createdAt: timestamp,
      })),
    ];
  }

  next.updatedAt = timestamp;
  return next;
}

export function mapImageGenerationInput(
  profile: CharacterProfile,
  input: GenerateCharacterImageInput,
  config: RunwayAdapterConfig,
  continuityBundleId?: string,
): { request: RunwayCreateGenerationJobRequest; job: GenerationJob } {
  const continuityInstructions = buildContinuityInstructions(
    profile,
    input.consistencyHints ?? [],
  );
  const outputName = createOutputName(profile.slug, input.shotLabel ?? "still");
  const promptSnapshot: PromptSnapshot = {
    prompt: input.prompt,
    aspectRatio: input.aspectRatio ?? config.defaultAspectRatio,
    continuityInstructions,
    referenceImageIds: profile.referenceImages.map((image) => image.id),
    variants: input.variants ?? 1,
    ...(input.negativePrompt !== undefined
      ? { negativePrompt: input.negativePrompt }
      : {}),
    ...(input.framing !== undefined ? { framing: input.framing } : {}),
    ...(input.cameraLanguage !== undefined
      ? { cameraLanguage: input.cameraLanguage }
      : {}),
    ...(input.lens !== undefined ? { lens: input.lens } : {}),
    ...(input.lighting !== undefined ? { lighting: input.lighting } : {}),
    ...(input.mood !== undefined ? { mood: input.mood } : {}),
    ...(input.environment !== undefined ? { environment: input.environment } : {}),
    ...(input.referenceStrength !== undefined
      ? { referenceStrength: input.referenceStrength }
      : {}),
    ...(input.seed !== undefined ? { seed: input.seed } : {}),
    outputName,
  };

  const resolvedPrompt = composePrompt(input.prompt, {
    framing: input.framing,
    cameraLanguage: input.cameraLanguage,
    lens: input.lens,
    lighting: input.lighting,
    mood: input.mood,
    environment: input.environment,
    continuityInstructions,
  });
  promptSnapshot.resolvedPrompt = resolvedPrompt;

  const request: RunwayCreateGenerationJobRequest = {
    type: "image",
    input: {
      prompt: resolvedPrompt,
      aspectRatio: promptSnapshot.aspectRatio,
      variants: promptSnapshot.variants,
      continuityInstructions,
      references: buildReferenceAssets(profile, input.referenceStrength),
      metadata: {
        characterId: profile.id,
        characterSlug: profile.slug,
        outputName,
        workflowType: "character-image",
        promptHints: {
          ...(input.framing !== undefined ? { framing: input.framing } : {}),
          ...(input.cameraLanguage !== undefined ? { cameraLanguage: input.cameraLanguage } : {}),
          ...(input.lens !== undefined ? { lens: input.lens } : {}),
          ...(input.lighting !== undefined ? { lighting: input.lighting } : {}),
          ...(input.mood !== undefined ? { mood: input.mood } : {}),
          ...(input.environment !== undefined ? { environment: input.environment } : {}),
          ...(input.referenceStrength !== undefined ? { referenceStrength: input.referenceStrength } : {}),
          ...(input.seed !== undefined ? { seed: input.seed } : {}),
        },
      },
      ...(input.negativePrompt !== undefined
        ? { negativePrompt: input.negativePrompt }
        : {}),
    },
  };

  return {
    request,
    job: createJobDraft(profile.id, "image", promptSnapshot, request, continuityBundleId),
  };
}

export function mapVideoGenerationInput(
  profile: CharacterProfile,
  input: GenerateCharacterVideoInput,
  config: RunwayAdapterConfig,
  continuityBundleId?: string,
): { request: RunwayCreateGenerationJobRequest; job: GenerationJob } {
  const continuityInstructions = buildContinuityInstructions(
    profile,
    input.continuityConstraints ?? [],
  );
  const outputName = createOutputName(profile.slug, input.shotLabel ?? "motion");
  const promptSnapshot: PromptSnapshot = {
    prompt: input.scenePrompt,
    aspectRatio: input.aspectRatio ?? config.defaultAspectRatio,
    continuityInstructions,
    referenceImageIds: profile.referenceImages.map((image) => image.id),
    variants: input.variants ?? 1,
    ...(input.motionPrompt !== undefined ? { motionPrompt: input.motionPrompt } : {}),
    ...(input.negativePrompt !== undefined
      ? { negativePrompt: input.negativePrompt }
      : {}),
    ...(input.cameraLanguage !== undefined
      ? { cameraLanguage: input.cameraLanguage }
      : {}),
    ...(input.lighting !== undefined ? { lighting: input.lighting } : {}),
    ...(input.mood !== undefined ? { mood: input.mood } : {}),
    ...(input.environment !== undefined ? { environment: input.environment } : {}),
    ...(input.shotType !== undefined ? { shotType: input.shotType } : {}),
    ...(input.cameraMotion !== undefined
      ? { cameraMotion: input.cameraMotion }
      : {}),
    ...(input.durationSeconds !== undefined
      ? { durationSeconds: input.durationSeconds }
      : {}),
    ...(input.fps !== undefined ? { fps: input.fps } : {}),
    ...(input.seed !== undefined ? { seed: input.seed } : {}),
    outputName,
  };

  const resolvedPrompt = composePrompt(input.scenePrompt, {
    cameraLanguage: input.cameraLanguage,
    lighting: input.lighting,
    mood: input.mood,
    environment: input.environment,
    motionPrompt: input.motionPrompt,
    shotType: input.shotType,
    cameraMotion: input.cameraMotion,
    continuityInstructions,
  });
  promptSnapshot.resolvedPrompt = resolvedPrompt;

  const request: RunwayCreateGenerationJobRequest = {
    type: "video",
    input: {
      prompt: resolvedPrompt,
      aspectRatio: promptSnapshot.aspectRatio,
      variants: promptSnapshot.variants,
      continuityInstructions,
      references: buildReferenceAssets(profile),
      metadata: {
        characterId: profile.id,
        characterSlug: profile.slug,
        outputName,
        workflowType: "character-video",
        promptHints: {
          ...(input.motionPrompt !== undefined ? { motionPrompt: input.motionPrompt } : {}),
          ...(input.shotType !== undefined ? { shotType: input.shotType } : {}),
          ...(input.cameraMotion !== undefined ? { cameraMotion: input.cameraMotion } : {}),
          ...(input.cameraLanguage !== undefined ? { cameraLanguage: input.cameraLanguage } : {}),
          ...(input.durationSeconds !== undefined ? { durationSeconds: input.durationSeconds } : {}),
          ...(input.fps !== undefined ? { fps: input.fps } : {}),
          ...(input.lighting !== undefined ? { lighting: input.lighting } : {}),
          ...(input.mood !== undefined ? { mood: input.mood } : {}),
          ...(input.environment !== undefined ? { environment: input.environment } : {}),
          ...(input.seed !== undefined ? { seed: input.seed } : {}),
        },
      },
      ...(input.motionPrompt !== undefined ? { motionPrompt: input.motionPrompt } : {}),
      ...(input.negativePrompt !== undefined
        ? { negativePrompt: input.negativePrompt }
        : {}),
    },
  };

  return {
    request,
    job: createJobDraft(profile.id, "video", promptSnapshot, request, continuityBundleId),
  };
}

function mapStoryboardShot(
  bundleId: string,
  characterId: string,
  shot: StoryboardShotInput,
  continuityNotes: string[],
  jobId: string,
  status: GenerationJob["status"],
): StoryboardShot {
  const mediaType =
    shot.mediaType ?? (shot.durationSeconds !== undefined ? "video" : "image");

  return {
    id: createId("shot"),
    bundleId,
    characterId,
    mediaType,
    prompt: shot.prompt,
    continuityNotes,
    jobId,
    status,
    ...(shot.title !== undefined ? { title: shot.title } : {}),
    ...(shot.negativePrompt !== undefined
      ? { negativePrompt: shot.negativePrompt }
      : {}),
    ...(shot.framing !== undefined ? { framing: shot.framing } : {}),
    ...(shot.shotType !== undefined ? { shotType: shot.shotType } : {}),
    ...(shot.cameraLanguage !== undefined
      ? { cameraLanguage: shot.cameraLanguage }
      : {}),
    ...(shot.cameraMotion !== undefined
      ? { cameraMotion: shot.cameraMotion }
      : {}),
    ...(shot.lighting !== undefined ? { lighting: shot.lighting } : {}),
    ...(shot.mood !== undefined ? { mood: shot.mood } : {}),
    ...(shot.environment !== undefined ? { environment: shot.environment } : {}),
    ...(shot.durationSeconds !== undefined
      ? { durationSeconds: shot.durationSeconds }
      : {}),
    ...(shot.fps !== undefined ? { fps: shot.fps } : {}),
  };
}

export function mapStoryboardSequenceInput(
  profile: CharacterProfile,
  input: GenerateStoryboardSequenceInput,
  config: RunwayAdapterConfig,
): {
  bundleId: string;
  sequenceName: string;
  shots: Array<{
    shot: StoryboardShot;
    request: RunwayCreateGenerationJobRequest;
    job: GenerationJob;
  }>;
} {
  if (input.shots.length === 0) {
    throw new MappingError("Storyboard sequence requires at least one shot.");
  }

  const bundleId = createId("bundle");
  const sequenceName = input.sequenceName ?? `${profile.slug}-storyboard`;

  const shots = input.shots.map((shot) => {
    const continuityNotes = [
      ...(input.commonContinuityNotes ?? []),
      ...(shot.continuityNotes ?? []),
    ];
    const mediaType =
      shot.mediaType ?? (shot.durationSeconds !== undefined ? "video" : "image");
    const mapped =
      mediaType === "video"
        ? mapVideoGenerationInput(
            profile,
            {
              characterId: profile.id,
              scenePrompt: shot.prompt,
              negativePrompt: shot.negativePrompt,
              shotType: shot.shotType,
              cameraMotion: shot.cameraMotion,
              cameraLanguage: shot.cameraLanguage,
              durationSeconds: shot.durationSeconds,
              fps: shot.fps,
              aspectRatio: input.aspectRatio,
              lighting: shot.lighting,
              mood: shot.mood,
              environment: shot.environment,
              continuityConstraints: continuityNotes,
              variants: shot.variants,
              seed: shot.seed,
              shotLabel: shot.title,
            },
            config,
            bundleId,
          )
        : mapImageGenerationInput(
            profile,
            {
              characterId: profile.id,
              prompt: shot.prompt,
              negativePrompt: shot.negativePrompt,
              aspectRatio: input.aspectRatio,
              framing: shot.framing,
              cameraLanguage: shot.cameraLanguage,
              lighting: shot.lighting,
              mood: shot.mood,
              environment: shot.environment,
              consistencyHints: continuityNotes,
              variants: shot.variants,
              seed: shot.seed,
              shotLabel: shot.title,
            },
            config,
            bundleId,
          );

    return {
      request: mapped.request,
      job: mapped.job,
      shot: mapStoryboardShot(
        bundleId,
        profile.id,
        shot,
        continuityNotes,
        mapped.job.id,
        mapped.job.status,
      ),
    };
  });

  return {
    bundleId,
    sequenceName,
    shots,
  };
}
