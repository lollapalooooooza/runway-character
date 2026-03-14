import { mkdir, readdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createRunwayCharacterAdapter,
  resolveRunwayAdapterConfig,
} from "../src/index.js";
import {
  createCharacterProfilePayload,
  createFailedTaskResponse,
  createFetchStub,
  createQueuedTaskResponse,
  createRunningTaskResponse,
  createSucceededTaskResponse,
  createTaskAcceptedResponse,
  createTempConfig,
} from "./fixtures/factories.js";

describe("RunwayCharacterAdapter", () => {
  it("supports local-only configuration without an API key", async () => {
    const config = await createTempConfig();
    delete config.apiKey;

    const resolved = resolveRunwayAdapterConfig(config, {} as NodeJS.ProcessEnv);
    expect(resolved.apiKey).toBeUndefined();

    const adapter = createRunwayCharacterAdapter({
      ...resolved,
      fetchFn: createFetchStub([]),
    });

    const createResult = await adapter.executeTool(
      "create_character_profile",
      createCharacterProfilePayload(),
    );
    expect(createResult.ok).toBe(true);

    const characterId = (createResult.data as { character: { id: string } }).character.id;
    const generateResult = await adapter.executeTool("generate_character_image", {
      characterId,
      prompt: "Night portrait.",
    });

    expect(generateResult.ok).toBe(false);
    expect(generateResult.error?.code).toBe("UNSUPPORTED_FEATURE");
    expect(generateResult.error?.message).toContain("RUNWAY_API_KEY");
  });

  it("creates and persists character profiles locally", async () => {
    const config = await createTempConfig();
    const adapter = createRunwayCharacterAdapter({
      ...config,
      fetchFn: createFetchStub([]),
    });

    const result = await adapter.executeTool(
      "create_character_profile",
      createCharacterProfilePayload(),
    );

    expect(result.ok).toBe(true);
    const files = await readdir(config.charactersDir!);
    expect(files).toHaveLength(1);

    const data = result.data as { character: { id: string } };
    const fetched = await adapter.executeTool("get_character_profile", {
      characterId: data.character.id,
    });

    expect(fetched.ok).toBe(true);
    expect((fetched.data as { character: { name: string } }).character.name).toBe(
      "Ava Sterling",
    );
  });

  it("completes a successful generation flow with mocked fetch", async () => {
    const config = await createTempConfig();
    const fetchFn = createFetchStub([
      { body: createTaskAcceptedResponse("rw_task_1") },
      { body: createRunningTaskResponse("rw_task_1") },
      { body: createSucceededTaskResponse("rw_task_1") },
    ]);
    const adapter = createRunwayCharacterAdapter({ ...config, fetchFn });

    const createResult = await adapter.executeTool(
      "create_character_profile",
      createCharacterProfilePayload({ referenceImages: [] }),
    );
    const characterId = (createResult.data as { character: { id: string } }).character.id;

    const generateResult = await adapter.executeTool("generate_character_image", {
      characterId,
      prompt: "A moody rooftop portrait in the rain.",
      cameraLanguage: "35mm close-up",
      lighting: "wet neon rim light",
    });

    expect(generateResult.ok).toBe(true);
    const jobId = (generateResult.data as { rawJob: { id: string } }).rawJob.id;

    const waitResult = await adapter.executeTool("wait_for_generation_job", {
      jobId,
      pollIntervalMs: 0,
      maxAttempts: 5,
    });

    expect(waitResult.ok).toBe(true);
    expect((waitResult.data as { assets: Array<{ outputUrl: string }> }).assets).toHaveLength(1);

    const assetsResult = await adapter.executeTool("list_character_assets", {
      characterId,
    });

    expect(assetsResult.ok).toBe(true);
    expect((assetsResult.data as { assets: unknown[] }).assets).toHaveLength(1);
  });

  it("normalizes failed async generation jobs", async () => {
    const config = await createTempConfig();
    const fetchFn = createFetchStub([
      { body: createTaskAcceptedResponse("rw_task_fail") },
      { body: createFailedTaskResponse("rw_task_fail") },
    ]);
    const adapter = createRunwayCharacterAdapter({ ...config, fetchFn });

    const createResult = await adapter.executeTool(
      "create_character_profile",
      createCharacterProfilePayload({ referenceImages: [] }),
    );
    const characterId = (createResult.data as { character: { id: string } }).character.id;

    const generateResult = await adapter.executeTool("generate_character_image", {
      characterId,
      prompt: "Portrait at sunrise.",
    });
    const jobId = (generateResult.data as { rawJob: { id: string } }).rawJob.id;

    const waitResult = await adapter.executeTool("wait_for_generation_job", {
      jobId,
      pollIntervalMs: 0,
      maxAttempts: 2,
    });

    expect(waitResult.ok).toBe(false);
    expect(waitResult.error?.code).toBe("JOB_FAILED");
  });

  it("falls back to a safer reference-image strategy after an initial failure", async () => {
    const config = await createTempConfig();
    const fetchFn = createFetchStub([
      { body: createTaskAcceptedResponse("rw_task_initial") },
      { body: createSucceededTaskResponse("rw_task_initial") },
      { body: createTaskAcceptedResponse("rw_task_ref_fail") },
      { body: createFailedTaskResponse("rw_task_ref_fail") },
      { body: createTaskAcceptedResponse("rw_task_ref_fallback") },
      { body: createSucceededTaskResponse("rw_task_ref_fallback") },
    ]);
    const adapter = createRunwayCharacterAdapter({ ...config, fetchFn });

    const createResult = await adapter.executeTool(
      "create_character_profile",
      createCharacterProfilePayload({ referenceImages: [] }),
    );
    const characterId = (createResult.data as { character: { id: string } }).character.id;

    const firstGen = await adapter.executeTool("generate_character_image", {
      characterId,
      prompt: "First portrait.",
    });
    const firstJobId = (firstGen.data as { rawJob: { id: string } }).rawJob.id;
    const firstWait = await adapter.executeTool("wait_for_generation_job", {
      jobId: firstJobId,
      pollIntervalMs: 0,
      maxAttempts: 2,
    });
    const firstAssetUrl = (firstWait.data as { assets: Array<{ outputUrl: string }> }).assets[0]!.outputUrl;

    await adapter.executeTool("update_character_profile", {
      characterId,
      addReferenceImages: [
        { sourceType: "url", source: firstAssetUrl, role: "primary", label: "reference" },
      ],
    });

    const secondGen = await adapter.executeTool("generate_character_image", {
      characterId,
      prompt: "Aggressive same face and identity close-up portrait with dramatic studio lighting.",
      framing: "close-up",
      lighting: "dramatic studio lighting",
    });
    const secondJobId = (secondGen.data as { rawJob: { id: string } }).rawJob.id;
    const secondWait = await adapter.executeTool("wait_for_generation_job", {
      jobId: secondJobId,
      pollIntervalMs: 0,
      maxAttempts: 2,
    });

    expect(secondWait.ok).toBe(true);
    expect((secondWait.data as { job: { id: string } }).job.id).toContain("fallback_");
  });

  it("uploads local reference assets before generation", async () => {
    const config = await createTempConfig();
    const localRefPath = path.join(config.dataRootDir!, "reference.png");
    await mkdir(config.dataRootDir!, { recursive: true });
    await writeFile(localRefPath, "fake-image-data", "utf8");

    const responses = [
      { body: { id: "upload_1", uri: "runway://upload_1" } },
      { body: createTaskAcceptedResponse("rw_task_upload") },
    ];
    const fetchFn = createFetchStub(responses);
    const adapter = createRunwayCharacterAdapter({ ...config, fetchFn });

    const createResult = await adapter.executeTool(
      "create_character_profile",
      createCharacterProfilePayload({
        referenceImages: [
          {
            sourceType: "local",
            source: localRefPath,
            role: "primary",
          },
        ],
      }),
    );
    const characterId = (createResult.data as { character: { id: string } }).character.id;

    const generateResult = await adapter.executeTool("generate_character_image", {
      characterId,
      prompt: "Studio fashion portrait.",
    });

    expect(generateResult.ok).toBe(true);
    const profile = await adapter.executeTool("get_character_profile", { characterId });
    const saved = profile.data as { character: { referenceImages: Array<{ uploadedUri?: string; source: string }> } };
    expect(saved.character.referenceImages[0]?.uploadedUri).toBe("runway://upload_1");
    expect(saved.character.referenceImages[0]?.source).toBe("runway://upload_1");
  });

  it("downloads generated assets to local files", async () => {
    const config = await createTempConfig();
    const fetchFn = createFetchStub([
      { body: createTaskAcceptedResponse("rw_task_dl") },
      { body: createSucceededTaskResponse("rw_task_dl") },
    ]);
    const adapter = createRunwayCharacterAdapter({ ...config, fetchFn: (async (input, init) => {
      const url = String(input);
      if (url === "https://cdn.example.com/ava-still.png") {
        return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 });
      }
      return fetchFn(input, init);
    }) as typeof fetch });

    const createResult = await adapter.executeTool(
      "create_character_profile",
      createCharacterProfilePayload({ referenceImages: [] }),
    );
    const characterId = (createResult.data as { character: { id: string } }).character.id;

    const generateResult = await adapter.executeTool("generate_character_image", {
      characterId,
      prompt: "Editorial portrait.",
    });
    const jobId = (generateResult.data as { rawJob: { id: string } }).rawJob.id;

    const waitResult = await adapter.executeTool("wait_for_generation_job", {
      jobId,
      pollIntervalMs: 0,
      maxAttempts: 2,
    });
    const assetId = (waitResult.data as { assets: Array<{ id: string }> }).assets[0]!.id;

    const downloadResult = await adapter.executeTool("download_generated_asset", {
      assetId,
    });

    expect(downloadResult.ok).toBe(true);
    const filePath = (downloadResult.data as { filePath: string }).filePath;
    const fileStat = await stat(filePath);
    expect(fileStat.size).toBeGreaterThan(0);
  });
});
