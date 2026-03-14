import { describe, expect, it } from "vitest";

import {
  applyCharacterProfileUpdate,
  mapCreateCharacterProfileInput,
  mapImageGenerationInput,
  mapStoryboardSequenceInput,
} from "../src/mappers/requestMapper.js";
import {
  mapProviderStatus,
  mapRunwayResponseToAssets,
  mergeProviderJobState,
} from "../src/mappers/responseMapper.js";
import { createJob, createSucceededJobResponse, createSucceededTaskResponse } from "./fixtures/factories.js";
import { createCharacterProfilePayload, createTempConfig } from "./fixtures/factories.js";

describe("request and response mappers", () => {
  it("maps image generation input into a provider request with continuity hints", async () => {
    const config = await createTempConfig();
    const profile = mapCreateCharacterProfileInput(createCharacterProfilePayload());

    const mapped = mapImageGenerationInput(
      profile,
      {
        characterId: profile.id,
        prompt: "Ava leans against a rain-soaked window.",
        cameraLanguage: "85mm portrait",
        lighting: "cool blue rim light",
        consistencyHints: ["Keep the signet ring visible."],
      },
      {
        apiKey: config.apiKey!,
        baseUrl: config.baseUrl!,
        timeoutMs: config.timeoutMs!,
        maxRetries: config.maxRetries!,
        pollIntervalMs: config.pollIntervalMs!,
        defaultAspectRatio: config.defaultAspectRatio!,
        defaultOutputDir: config.defaultOutputDir!,
        debug: config.debug!,
        useLocalStore: config.useLocalStore!,
        dataRootDir: config.dataRootDir!,
        charactersDir: config.charactersDir!,
        assetsDir: config.assetsDir!,
        jobsDir: config.jobsDir!,
        apiPaths: config.apiPaths!,
      },
    );

    expect(mapped.request.type).toBe("image");
    expect(mapped.request.input.references).toHaveLength(1);
    expect(mapped.request.input.prompt).toContain("Character continuity");
    expect(mapped.job.promptSnapshot.continuityInstructions.join(" ")).toContain(
      "Keep the signet ring visible.",
    );
  });

  it("applies character profile updates and storyboard mapping", async () => {
    const config = await createTempConfig();
    const profile = mapCreateCharacterProfileInput(createCharacterProfilePayload());
    const updated = applyCharacterProfileUpdate(profile, {
      characterId: profile.id,
      styleConstraints: {
        visualLanguage: "graphic moonlit realism",
      },
      continuityNote: "Add a cracked earring to the left ear.",
    });

    expect(updated.visualLanguage).toBe("graphic moonlit realism");
    expect(updated.continuityNotes).toHaveLength(2);

    const storyboard = mapStoryboardSequenceInput(
      updated,
      {
        characterId: updated.id,
        shots: [
          { prompt: "Establishing shot of Ava entering frame." },
          {
            prompt: "Tracking move around Ava.",
            mediaType: "video",
            durationSeconds: 4,
          },
        ],
      },
      {
        apiKey: config.apiKey!,
        baseUrl: config.baseUrl!,
        timeoutMs: config.timeoutMs!,
        maxRetries: config.maxRetries!,
        pollIntervalMs: config.pollIntervalMs!,
        defaultAspectRatio: config.defaultAspectRatio!,
        defaultOutputDir: config.defaultOutputDir!,
        debug: config.debug!,
        useLocalStore: config.useLocalStore!,
        dataRootDir: config.dataRootDir!,
        charactersDir: config.charactersDir!,
        assetsDir: config.assetsDir!,
        jobsDir: config.jobsDir!,
        apiPaths: config.apiPaths!,
      },
    );

    expect(storyboard.shots).toHaveLength(2);
    expect(storyboard.shots[1]!.job.mediaType).toBe("video");
  });

  it("normalizes provider responses into assets and statuses", () => {
    const profile = mapCreateCharacterProfileInput(createCharacterProfilePayload());
    const mapped = mapImageGenerationInput(
      profile,
      {
        characterId: profile.id,
        prompt: "Portrait of Ava.",
      },
      {
        apiKey: "test",
        baseUrl: "https://example.test/v1",
        timeoutMs: 1000,
        maxRetries: 0,
        pollIntervalMs: 0,
        defaultAspectRatio: "16:9",
        defaultOutputDir: "/tmp",
        debug: false,
        useLocalStore: true,
        dataRootDir: "/tmp/data",
        charactersDir: "/tmp/data/characters",
        assetsDir: "/tmp/data/assets",
        jobsDir: "/tmp/data/jobs",
        apiPaths: {
          createGenerationJob: "generation-jobs",
          getGenerationJob: (providerJobId: string) => `generation-jobs/${providerJobId}`,
          cancelGenerationJob: (providerJobId: string) => `generation-jobs/${providerJobId}/cancel`,
          uploadAsset: "uploads",
        },
      },
    );

    const response = createSucceededJobResponse("rw_job_1");
    const assets = mapRunwayResponseToAssets(mapped.job, response);
    const merged = mergeProviderJobState(
      { ...mapped.job, providerJobId: "rw_job_1" },
      response,
      assets,
    );

    expect(mapProviderStatus("completed")).toBe("succeeded");
    expect(assets).toHaveLength(1);
    expect(assets[0]!.outputUrl).toContain("ava-still");
    expect(merged.status).toBe("succeeded");
    expect(merged.outputAssetIds).toHaveLength(1);
  });

  it("normalizes looser raw provider asset shapes", () => {
    const job = createJob("queued");
    const response = {
      id: "rw_job_raw",
      status: "completed",
      raw: {
        output: {
          images: [
            {
              assetId: "asset_raw_1",
              type: "image",
              uri: "https://cdn.example.com/raw-image.png",
            },
          ],
        },
      },
    };

    const assets = mapRunwayResponseToAssets(job, response);
    expect(assets).toHaveLength(1);
    expect(assets[0]!.providerAssetId).toBe("asset_raw_1");
    expect(assets[0]!.outputUrl).toBe("https://cdn.example.com/raw-image.png");
  });

  it("normalizes task-style output arrays from the current Runway API", () => {
    const job = createJob("queued");
    const response = createSucceededTaskResponse("rw_task_1");

    const assets = mapRunwayResponseToAssets(job, response);
    expect(assets).toHaveLength(1);
    expect(assets[0]!.outputUrl).toBe("https://cdn.example.com/ava-still.png");
  });
});
