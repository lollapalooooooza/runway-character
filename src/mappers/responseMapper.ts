import { createId } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";
import { isRecord } from "../utils/guards.js";
import type {
  CharacterProfile,
  GeneratedAsset,
  GenerationJob,
  GenerationJobStatus,
  JsonObject,
  OpenClawToolResult,
  RunwayGenerationJobResponse,
  StoryboardShot,
} from "../types.js";

function summarizeCharacter(profile: CharacterProfile): JsonObject {
  return {
    id: profile.id,
    name: profile.name,
    slug: profile.slug,
    referenceImageCount: profile.referenceImages.length,
    continuityNoteCount: profile.continuityNotes.length,
    styleTags: [...profile.styleTags],
    consistencyRules: [...profile.consistencyRules],
  };
}

function summarizeJob(job: GenerationJob, assets: GeneratedAsset[] = []): JsonObject {
  return {
    id: job.id,
    providerJobId: job.providerJobId ?? null,
    characterId: job.characterId,
    mediaType: job.mediaType,
    status: job.status,
    providerStatus: job.providerStatus ?? null,
    continuityBundleId: job.continuityBundleId ?? null,
    outputAssetIds: [...job.outputAssetIds],
    outputCount: assets.length,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt ?? null,
  };
}

export function mapProviderStatus(status?: string): GenerationJobStatus {
  if (!status) {
    return "unknown";
  }

  const normalized = status.toLowerCase();

  if (["queued", "pending", "created", "submitted"].includes(normalized)) {
    return "queued";
  }

  if (["running", "processing", "in_progress", "active"].includes(normalized)) {
    return "running";
  }

  if (["succeeded", "completed", "done", "success"].includes(normalized)) {
    return "succeeded";
  }

  if (["failed", "error"].includes(normalized)) {
    return "failed";
  }

  if (["cancelled", "canceled"].includes(normalized)) {
    return "cancelled";
  }

  return "unknown";
}

function normalizeResponseAssets(
  response: RunwayGenerationJobResponse,
): NonNullable<RunwayGenerationJobResponse["assets"]> {
  const directAssets = response.output?.assets ?? response.assets;
  if (Array.isArray(directAssets)) {
    return directAssets;
  }

  if (Array.isArray(response.output)) {
    return response.output
      .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
      .map((url, index) => ({
        id: `${response.id ?? "task"}-asset-${index + 1}`,
        assetId: `${response.id ?? "task"}-asset-${index + 1}`,
        mediaType: "image",
        type: "image",
        url,
        outputUrl: url,
      }));
  }

  const raw = response.raw;
  if (isRecord(raw)) {
    const output = isRecord(raw.output) ? raw.output : undefined;
    const data = isRecord(raw.data) ? raw.data : undefined;
    const candidates = [raw.assets, output?.assets, output?.images, output?.videos, data?.assets, data?.images, data?.videos];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate as NonNullable<RunwayGenerationJobResponse["assets"]>;
      }
    }
  }

  return [];
}

function getResponseAssetUrl(asset: NonNullable<RunwayGenerationJobResponse["assets"]>[number]): string | undefined {
  return asset.outputUrl ?? asset.url ?? asset.uri;
}

function getResponseAssetId(asset: NonNullable<RunwayGenerationJobResponse["assets"]>[number]): string | undefined {
  return asset.id ?? asset.assetId;
}

function getResponseAssetType(asset: NonNullable<RunwayGenerationJobResponse["assets"]>[number]): string | undefined {
  return asset.mediaType ?? asset.type;
}

export function mapRunwayResponseToAssets(
  job: GenerationJob,
  response: RunwayGenerationJobResponse,
): GeneratedAsset[] {
  const assets = normalizeResponseAssets(response);

  return assets
    .map((asset) => {
      const outputUrl = getResponseAssetUrl(asset);

      if (!outputUrl) {
        return undefined;
      }

      return {
        id: createId("asset"),
        jobId: job.id,
        characterId: job.characterId,
        mediaType:
          getResponseAssetType(asset) === "video" || getResponseAssetType(asset) === "image"
            ? (getResponseAssetType(asset) as "video" | "image")
            : job.mediaType,
        outputUrl,
        promptSnapshot: job.promptSnapshot,
        generationMetadata: {
          ...(asset.width !== undefined ? { width: asset.width } : {}),
          ...(asset.height !== undefined ? { height: asset.height } : {}),
          ...(asset.durationSeconds !== undefined
            ? { durationSeconds: asset.durationSeconds }
            : {}),
          ...(asset.fps !== undefined ? { fps: asset.fps } : {}),
          ...(asset.fileName !== undefined ? { fileName: asset.fileName } : {}),
          ...(response.output?.metadata ? { outputMetadata: response.output.metadata } : {}),
          ...(asset.metadata ? { providerMetadata: asset.metadata } : {}),
        },
        createdAt: nowIso(),
        ...(job.continuityBundleId !== undefined
          ? { continuityBundleId: job.continuityBundleId }
          : {}),
        ...(asset.thumbnailUrl !== undefined
          ? { thumbnailUrl: asset.thumbnailUrl }
          : response.output?.thumbnailUrl !== undefined
            ? { thumbnailUrl: response.output.thumbnailUrl }
            : {}),
        ...(asset.localPath !== undefined ? { localPath: asset.localPath } : {}),
        ...(getResponseAssetId(asset) !== undefined ? { providerAssetId: getResponseAssetId(asset) } : {}),
      } satisfies GeneratedAsset;
    })
    .filter((asset): asset is GeneratedAsset => asset !== undefined);
}

export function mergeProviderJobState(
  job: GenerationJob,
  response: RunwayGenerationJobResponse,
  assets: GeneratedAsset[],
): GenerationJob {
  const next: GenerationJob = {
    ...job,
    providerJobId: response.id ?? job.providerJobId,
    status: mapProviderStatus(response.status),
    providerStatus: response.status ?? job.providerStatus,
    outputAssetIds: assets.map((asset) => asset.id),
    rawProviderResponse: (response.raw ?? response) as GenerationJob["rawProviderResponse"],
    updatedAt: nowIso(),
  };

  if (
    next.status === "succeeded" ||
    next.status === "failed" ||
    next.status === "cancelled"
  ) {
    next.completedAt = nowIso();
  } else {
    delete next.completedAt;
  }

  if (response.error?.message) {
    next.error = {
      message: response.error.message,
      ...(response.error.code !== undefined ? { code: response.error.code } : {}),
      ...(response.error.retryable !== undefined
        ? { retryable: response.error.retryable }
        : {}),
      ...(response.error.details !== undefined
        ? { details: response.error.details }
        : {}),
    };
  } else {
    delete next.error;
  }

  return next;
}

export function mapCharacterProfileResult(
  toolName: string,
  profile: CharacterProfile,
  mode: "created" | "retrieved" | "updated",
): OpenClawToolResult {
  const actionText =
    mode === "created"
      ? "Created"
      : mode === "updated"
        ? "Updated"
        : "Fetched";

  return {
    ok: true,
    toolName,
    summary: `${actionText} character profile for ${profile.name} (${profile.id}).`,
    data: {
      character: profile,
      characterSummary: summarizeCharacter(profile),
    },
    nextActions: [
      "generate_character_image",
      "generate_character_video",
      "generate_storyboard_sequence",
    ],
  };
}

export function mapGenerationJobAcceptedResult(
  toolName: string,
  job: GenerationJob,
  profile: CharacterProfile,
  assets: GeneratedAsset[] = [],
): OpenClawToolResult {
  return {
    ok: true,
    toolName,
    summary: `Submitted ${job.mediaType} generation job ${job.id} for ${profile.name}. Current status: ${job.status}.`,
    data: {
      job: summarizeJob(job, assets),
      rawJob: job,
      character: summarizeCharacter(profile),
      assets,
    },
    nextActions: ["get_generation_job", "wait_for_generation_job"],
  };
}

export function mapGenerationJobResult(
  toolName: string,
  job: GenerationJob,
  assets: GeneratedAsset[],
): OpenClawToolResult {
  return {
    ok: true,
    toolName,
    summary:
      job.status === "succeeded"
        ? `Job ${job.id} succeeded with ${assets.length} asset(s).`
        : `Job ${job.id} is ${job.status}.`,
    data: {
      job: summarizeJob(job, assets),
      rawJob: job,
      assets,
    },
    nextActions:
      job.status === "succeeded"
        ? ["list_character_assets"]
        : ["wait_for_generation_job"],
  };
}

export function mapWaitForJobResult(
  toolName: string,
  job: GenerationJob,
  assets: GeneratedAsset[],
  attempts: number,
): OpenClawToolResult {
  const baseResult: OpenClawToolResult = {
    ok: job.status === "succeeded",
    toolName,
    summary:
      job.status === "succeeded"
        ? `Job ${job.id} completed after ${attempts} poll attempt(s).`
        : `Job ${job.id} ended with status ${job.status}.`,
    data: {
      job: summarizeJob(job, assets),
      rawJob: job,
      assets,
      attempts,
    },
    nextActions:
      job.status === "succeeded"
        ? ["list_character_assets"]
        : ["get_generation_job"],
  };

  if (job.status === "failed" || job.status === "cancelled") {
    baseResult.error = {
      code: job.status === "failed" ? "JOB_FAILED" : "JOB_CANCELLED",
      message: job.error?.message ?? `Job ${job.id} ${job.status}.`,
      retryable: false,
      ...(job.error?.details ? { details: job.error.details } : {}),
    };
  }

  return baseResult;
}

export function mapStoryboardSequenceResult(
  toolName: string,
  profile: CharacterProfile,
  bundleId: string,
  sequenceName: string,
  shots: StoryboardShot[],
  jobs: GenerationJob[],
): OpenClawToolResult {
  return {
    ok: true,
    toolName,
    summary: `Submitted storyboard bundle ${bundleId} (${sequenceName}) with ${shots.length} shot(s) for ${profile.name}.`,
    data: {
      bundleId,
      sequenceName,
      character: summarizeCharacter(profile),
      shots,
      jobs: jobs.map((job) => summarizeJob(job)),
    },
    nextActions: ["wait_for_generation_job", "get_generation_job"],
  };
}

export function mapAssetListResult(
  toolName: string,
  profile: CharacterProfile,
  assets: GeneratedAsset[],
): OpenClawToolResult {
  return {
    ok: true,
    toolName,
    summary: `Found ${assets.length} generated asset(s) for ${profile.name}.`,
    data: {
      character: summarizeCharacter(profile),
      assets,
    },
  };
}
