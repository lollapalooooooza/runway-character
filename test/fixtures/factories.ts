import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import { vi } from "vitest";

import type {
  CreateCharacterProfileInput,
  GenerationJob,
  GeneratedAsset,
  RunwayAdapterConfig,
  RunwayGenerationJobResponse,
} from "../../src/types.js";

export async function createTempConfig(
  overrides: Partial<RunwayAdapterConfig> = {},
): Promise<Partial<RunwayAdapterConfig>> {
  const root = await mkdtemp(path.join(os.tmpdir(), "runway-character-adapter-"));
  const dataRootDir = path.join(root, "data");

  return {
    apiKey: "test-api-key",
    baseUrl: "https://api.dev.runwayml.com/v1",
    timeoutMs: 1_000,
    maxRetries: 0,
    pollIntervalMs: 0,
    defaultAspectRatio: "16:9",
    defaultOutputDir: path.join(dataRootDir, "generated"),
    debug: false,
    useLocalStore: true,
    dataRootDir,
    charactersDir: path.join(dataRootDir, "characters"),
    assetsDir: path.join(dataRootDir, "assets"),
    jobsDir: path.join(dataRootDir, "jobs"),
    apiPaths: {
      createGenerationJob: "generation-jobs",
      getGenerationJob: (providerJobId: string) => `generation-jobs/${providerJobId}`,
      cancelGenerationJob: (providerJobId: string) => `generation-jobs/${providerJobId}/cancel`,
      uploadAsset: "uploads",
    },
    ...overrides,
  };
}

export function createCharacterProfilePayload(
  overrides: Partial<CreateCharacterProfileInput> = {},
): CreateCharacterProfileInput {
  return {
    name: "Ava Sterling",
    description: "Detective lead for a neon-noir world.",
    visualSummary: "Short black hair, amber eyes, tailored coat, focused posture.",
    ageRange: "30s",
    genderPresentation: "feminine",
    ethnicityOrAppearanceNotes: "East Asian features, pale skin, composed expression.",
    wardrobe: ["tailored navy coat", "charcoal turtleneck"],
    accessories: ["silver signet ring"],
    styleTags: ["cinematic", "neon-noir", "high contrast"],
    consistencyRules: ["Keep amber eyes", "Maintain tailored silhouette"],
    referenceImages: [
      {
        sourceType: "url",
        source: "https://assets.example.com/ava-front.jpg",
        role: "primary",
        label: "front portrait",
        weight: 1,
      },
    ],
    continuityNotes: ["Left cheek scar stays visible."],
    ...overrides,
  };
}

export function createTaskAcceptedResponse(id: string): { id: string } {
  return { id };
}

export function createQueuedTaskResponse(id: string): RunwayGenerationJobResponse {
  return {
    id,
    status: "PENDING",
    output: [],
  } as unknown as RunwayGenerationJobResponse;
}

export function createRunningTaskResponse(id: string): RunwayGenerationJobResponse {
  return {
    id,
    status: "RUNNING",
    output: [],
  } as unknown as RunwayGenerationJobResponse;
}

export function createSucceededTaskResponse(
  id: string,
  mediaType: "image" | "video" = "image",
): RunwayGenerationJobResponse {
  return {
    id,
    status: "SUCCEEDED",
    output: [
      mediaType === "image"
        ? "https://cdn.example.com/ava-still.png"
        : "https://cdn.example.com/ava-motion.mp4",
    ],
  } as unknown as RunwayGenerationJobResponse;
}

export function createSucceededJobResponse(
  id: string,
  mediaType: "image" | "video" = "image",
): RunwayGenerationJobResponse {
  return {
    id,
    status: "succeeded",
    output: {
      assets: [
        {
          id: `${id}_asset_1`,
          mediaType,
          outputUrl:
            mediaType === "image"
              ? "https://cdn.example.com/ava-still.png"
              : "https://cdn.example.com/ava-motion.mp4",
          thumbnailUrl: "https://cdn.example.com/ava-thumb.png",
          width: 1024,
          height: 1536,
          durationSeconds: mediaType === "video" ? 4 : undefined,
          fps: mediaType === "video" ? 24 : undefined,
        },
      ],
    },
  };
}

export function createFailedTaskResponse(id: string): RunwayGenerationJobResponse {
  return {
    id,
    status: "FAILED",
    failure: "The upstream render failed.",
  } as unknown as RunwayGenerationJobResponse;
}

export function createFailedJobResponse(id: string): RunwayGenerationJobResponse {
  return {
    id,
    status: "failed",
    error: {
      code: "render_failed",
      message: "The upstream render failed.",
      retryable: false,
    },
  };
}

export function createFetchStub(
  responses: Array<{ status?: number; body: unknown }>,
): typeof fetch {
  const mock = vi.fn(async () => {
    const next = responses.shift();

    if (!next) {
      throw new Error("No mocked fetch response left.");
    }

    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  return mock as unknown as typeof fetch;
}

export function createJob(status: GenerationJob["status"]): GenerationJob {
  return {
    id: "job_test",
    characterId: "char_test",
    mediaType: "image",
    status,
    promptSnapshot: {
      prompt: "portrait of Ava",
      aspectRatio: "16:9",
      continuityInstructions: ["Preserve Ava."],
      referenceImageIds: ["ref_1"],
      variants: 1,
    },
    request: {
      type: "image",
      input: {
        prompt: "portrait of Ava",
        aspectRatio: "16:9",
        variants: 1,
        continuityInstructions: ["Preserve Ava."],
        references: [],
      },
    },
    outputAssetIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createAsset(): GeneratedAsset {
  return {
    id: "asset_test",
    jobId: "job_test",
    characterId: "char_test",
    mediaType: "image",
    outputUrl: "https://cdn.example.com/asset.png",
    promptSnapshot: {
      prompt: "portrait of Ava",
      aspectRatio: "16:9",
      continuityInstructions: ["Preserve Ava."],
      referenceImageIds: ["ref_1"],
      variants: 1,
    },
    generationMetadata: {},
    createdAt: new Date().toISOString(),
  };
}
