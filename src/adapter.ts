import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { RunwayClient } from "./client/runwayClient.js";
import { resolveRunwayAdapterConfig } from "./config.js";
import { ConfigError, NotFoundError } from "./errors.js";
import { normalizeAdapterError } from "./mappers/errorMapper.js";
import {
  applyCharacterProfileUpdate,
  mapCreateCharacterProfileInput,
  mapImageGenerationInput,
  mapStoryboardSequenceInput,
  mapVideoGenerationInput,
} from "./mappers/requestMapper.js";
import {
  mapAssetListResult,
  mapCharacterProfileResult,
  mapGenerationJobAcceptedResult,
  mapGenerationJobResult,
  mapProviderStatus,
  mapRunwayResponseToAssets,
  mapStoryboardSequenceResult,
  mapWaitForJobResult,
  mergeProviderJobState,
} from "./mappers/responseMapper.js";
import { AdapterLifecycle } from "./runtime/lifecycle.js";
import { PollingManager } from "./runtime/polling.js";
import { AssetStore } from "./storage/assetStore.js";
import { CharacterStore } from "./storage/characterStore.js";
import { JobStore } from "./storage/jobStore.js";
import { createCharacterProfileTool } from "./tools/createCharacterProfile.js";
import { createCharacterFromKnowledgeTool, toKnowledgeInput } from "./tools/createCharacterFromKnowledge.js";
import { ingestCharacterKnowledge, ingestCharacterKnowledgeTool } from "./tools/ingestCharacterKnowledge.js";
import { createLiveAvatarTool } from "./tools/createLiveAvatar.js";
import { createRealtimeSessionTool } from "./tools/createRealtimeSession.js";
import { generateCharacterImageTool } from "./tools/generateCharacterImage.js";
import { generateCharacterVideoTool } from "./tools/generateCharacterVideo.js";
import { generateStoryboardSequenceTool } from "./tools/generateStoryboardSequence.js";
import { getCharacterProfileTool } from "./tools/getCharacterProfile.js";
import { getGenerationJobTool } from "./tools/getGenerationJob.js";
import { getLiveAvatarTool } from "./tools/getLiveAvatar.js";
import { getRealtimeSessionTool } from "./tools/getRealtimeSession.js";
import { listCharacterAssetsTool } from "./tools/listCharacterAssets.js";
import { updateCharacterProfileTool } from "./tools/updateCharacterProfile.js";
import { waitForGenerationJobTool } from "./tools/waitForGenerationJob.js";
import { consumeRealtimeSessionTool } from "./tools/consumeRealtimeSession.js";
import { waitForRealtimeSessionTool } from "./tools/waitForRealtimeSession.js";
import { downloadGeneratedAssetTool } from "./tools/downloadGeneratedAsset.js";
import type {
  AssetStoreContract,
  CharacterProfile,
  CharacterStoreContract,
  ConsumeRealtimeSessionInput,
  CreateCharacterFromKnowledgeInput,
  CreateCharacterProfileInput,
  CreateLiveAvatarInput,
  IngestCharacterKnowledgeInput,
  CreateRealtimeSessionInput,
  DownloadGeneratedAssetInput,
  GenerateCharacterImageInput,
  GenerateCharacterVideoInput,
  GenerateStoryboardSequenceInput,
  GeneratedAsset,
  GetCharacterProfileInput,
  GetGenerationJobInput,
  GetLiveAvatarInput,
  GetRealtimeSessionInput,
  JobStoreContract,
  ListCharacterAssetsInput,
  OpenClawToolDefinition,
  OpenClawToolResult,
  RunwayAdapterConfig,
  RunwayClientContract,
  RunwayToolContext,
  UpdateCharacterProfileInput,
  WaitForGenerationJobInput,
  WaitForRealtimeSessionInput,
} from "./types.js";
import { createLogger, serializeError, type Logger } from "./utils/logger.js";
import { nowIso } from "./utils/time.js";

export interface RunwayCharacterAdapterDependencies {
  characterStore?: CharacterStoreContract;
  assetStore?: AssetStoreContract;
  jobStore?: JobStoreContract;
  client?: RunwayClientContract;
  logger?: Logger;
  lifecycle?: AdapterLifecycle;
  pollingManager?: PollingManager;
}

export class RunwayCharacterAdapter implements RunwayToolContext {
  readonly config: RunwayAdapterConfig;
  readonly logger: Logger;
  readonly characterStore: CharacterStoreContract;
  readonly assetStore: AssetStoreContract;
  readonly jobStore: JobStoreContract;
  readonly client: RunwayClientContract;
  readonly lifecycle: AdapterLifecycle;
  readonly pollingManager: PollingManager;

  private readonly tools: Map<string, OpenClawToolDefinition>;

  constructor(
    configOverrides: Partial<RunwayAdapterConfig> = {},
    dependencies: RunwayCharacterAdapterDependencies = {},
  ) {
    this.config = resolveRunwayAdapterConfig(configOverrides);
    this.logger = dependencies.logger ?? createLogger({ debug: this.config.debug });

    if (
      !this.config.useLocalStore &&
      (!dependencies.characterStore ||
        !dependencies.assetStore ||
        !dependencies.jobStore)
    ) {
      throw new ConfigError(
        "RUNWAY_USE_LOCAL_STORE=false requires custom characterStore, assetStore, and jobStore implementations.",
      );
    }

    this.characterStore =
      dependencies.characterStore ?? new CharacterStore(this.config.charactersDir);
    this.assetStore = dependencies.assetStore ?? new AssetStore(this.config.assetsDir);
    this.jobStore = dependencies.jobStore ?? new JobStore(this.config.jobsDir);
    this.client = dependencies.client ?? new RunwayClient(this.config, this.logger);
    this.lifecycle = dependencies.lifecycle ?? new AdapterLifecycle();
    this.pollingManager =
      dependencies.pollingManager ??
      new PollingManager(
        {
          refreshJob: async (jobId) => this.refreshJob(jobId),
        },
        this.logger,
        this.config.pollIntervalMs,
      );

    this.lifecycle.registerCloseHandler(async () => {
      await this.client.close();
    });

    this.tools = new Map(
      [
        ingestCharacterKnowledgeTool(this),
        createCharacterFromKnowledgeTool(this),
        createCharacterProfileTool(this),
        getCharacterProfileTool(this),
        updateCharacterProfileTool(this),
        generateCharacterImageTool(this),
        generateCharacterVideoTool(this),
        generateStoryboardSequenceTool(this),
        getGenerationJobTool(this),
        waitForGenerationJobTool(this),
        listCharacterAssetsTool(this),
        downloadGeneratedAssetTool(this),
        createLiveAvatarTool(this),
        getLiveAvatarTool(this),
        createRealtimeSessionTool(this),
        getRealtimeSessionTool(this),
        waitForRealtimeSessionTool(this),
        consumeRealtimeSessionTool(this),
      ].map((tool) => [tool.name, tool]),
    );
  }

  getToolDefinitions(): OpenClawToolDefinition[] {
    return Array.from(this.tools.values());
  }

  async executeTool(name: string, input: unknown): Promise<OpenClawToolResult> {
    this.lifecycle.assertOpen();
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        ok: false,
        toolName: name,
        summary: `Tool ${name} is not registered.`,
        error: {
          code: "NOT_FOUND",
          message: `Tool ${name} is not registered.`,
          retryable: false,
        },
      };
    }

    try {
      const parsed = tool.parse(input);
      return await tool.handler(parsed);
    } catch (error) {
      const normalized = normalizeAdapterError(error);
      this.logger.error("Runway tool execution failed", {
        toolName: name,
        error: serializeError(error),
      });

      return {
        ok: false,
        toolName: name,
        summary: `${name} failed: ${normalized.message}`,
        error: normalized,
      };
    }
  }

  async close(): Promise<void> {
    await this.lifecycle.close();
  }

  async ingestCharacterKnowledge(
    input: IngestCharacterKnowledgeInput,
  ): Promise<OpenClawToolResult> {
    const { output, sourceLabel } = await ingestCharacterKnowledge(input);

    return {
      ok: true,
      toolName: "ingest_character_knowledge",
      summary: `Converted character knowledge from ${sourceLabel} into a structured character profile draft for ${output.profileDraft.name}.`,
      data: output,
      nextActions: output.suggestedNextActions,
    };
  }

  async createCharacterFromKnowledge(
    input: CreateCharacterFromKnowledgeInput,
  ): Promise<OpenClawToolResult> {
    const { output, sourceLabel } = await ingestCharacterKnowledge(
      toKnowledgeInput(input),
    );
    const profile = mapCreateCharacterProfileInput(output.profileDraft);
    await this.characterStore.create(profile);

    return {
      ok: true,
      toolName: "create_character_from_knowledge",
      summary: `Created character profile ${profile.name} (${profile.id}) directly from knowledge source ${sourceLabel}.`,
      data: {
        knowledge: output.knowledge,
        profileDraft: output.profileDraft,
        character: profile,
        characterSummary: {
          id: profile.id,
          name: profile.name,
          slug: profile.slug,
          referenceImageCount: profile.referenceImages.length,
        },
      },
      nextActions: ["get_character_profile", "generate_character_image", "update_character_profile"],
    };
  }

  async createCharacterProfile(
    input: CreateCharacterProfileInput,
  ): Promise<OpenClawToolResult> {
    const profile = mapCreateCharacterProfileInput(input);
    await this.characterStore.create(profile);

    return mapCharacterProfileResult(
      "create_character_profile",
      profile,
      "created",
    );
  }

  async getCharacterProfile(
    input: GetCharacterProfileInput,
  ): Promise<OpenClawToolResult> {
    const profile = await this.requireCharacter(input.characterId);

    return mapCharacterProfileResult(
      "get_character_profile",
      profile,
      "retrieved",
    );
  }

  async updateCharacterProfile(
    input: UpdateCharacterProfileInput,
  ): Promise<OpenClawToolResult> {
    const profile = await this.requireCharacter(input.characterId);
    const updated = applyCharacterProfileUpdate(profile, input);
    await this.characterStore.save(updated);

    return mapCharacterProfileResult(
      "update_character_profile",
      updated,
      "updated",
    );
  }

  async generateCharacterImage(
    input: GenerateCharacterImageInput,
  ): Promise<OpenClawToolResult> {
    const profile = await this.requireCharacter(input.characterId);
    const syncedProfile = await this.ensureReferenceAssetsUploaded(profile);
    const mapped = mapImageGenerationInput(syncedProfile, input, this.config);
    const { job, assets } = await this.submitJob(mapped.job, mapped.request);

    return mapGenerationJobAcceptedResult(
      "generate_character_image",
      job,
      syncedProfile,
      assets,
    );
  }

  async generateCharacterVideo(
    input: GenerateCharacterVideoInput,
  ): Promise<OpenClawToolResult> {
    const profile = await this.requireCharacter(input.characterId);
    const syncedProfile = await this.ensureReferenceAssetsUploaded(profile);
    const mapped = mapVideoGenerationInput(syncedProfile, input, this.config);
    const { job, assets } = await this.submitJob(mapped.job, mapped.request);

    return mapGenerationJobAcceptedResult(
      "generate_character_video",
      job,
      syncedProfile,
      assets,
    );
  }

  async generateStoryboardSequence(
    input: GenerateStoryboardSequenceInput,
  ): Promise<OpenClawToolResult> {
    const profile = await this.requireCharacter(input.characterId);
    const syncedProfile = await this.ensureReferenceAssetsUploaded(profile);
    const storyboard = mapStoryboardSequenceInput(syncedProfile, input, this.config);
    const submittedJobs = [];
    const submittedShots = [];

    for (const shot of storyboard.shots) {
      const { job } = await this.submitJob(shot.job, shot.request);
      submittedJobs.push(job);
      submittedShots.push({
        ...shot.shot,
        jobId: job.id,
        status: job.status,
      });
    }

    return mapStoryboardSequenceResult(
      "generate_storyboard_sequence",
      syncedProfile,
      storyboard.bundleId,
      storyboard.sequenceName,
      submittedShots,
      submittedJobs,
    );
  }

  async getGenerationJob(
    input: GetGenerationJobInput,
  ): Promise<OpenClawToolResult> {
    const { job, assets } = await this.refreshJob(input.jobId);
    return mapGenerationJobResult("get_generation_job", job, assets);
  }

  async waitForGenerationJob(
    input: WaitForGenerationJobInput,
  ): Promise<OpenClawToolResult> {
    const waitOptions = {
      ...(input.pollIntervalMs !== undefined
        ? { pollIntervalMs: input.pollIntervalMs }
        : {}),
      ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
      ...(input.maxAttempts !== undefined
        ? { maxAttempts: input.maxAttempts }
        : {}),
    };

    let { job, assets, attempts } = await this.pollingManager.waitForJob(
      input.jobId,
      waitOptions,
    );

    if (job.status === "failed") {
      const fallback = await this.tryReferenceImageFallback(job);
      if (fallback) {
        ({ job, assets, attempts } = await this.pollingManager.waitForJob(
          fallback.job.id,
          waitOptions,
        ));
      }
    }

    return mapWaitForJobResult(
      "wait_for_generation_job",
      job,
      assets,
      attempts,
    );
  }

  async listCharacterAssets(
    input: ListCharacterAssetsInput,
  ): Promise<OpenClawToolResult> {
    const profile = await this.requireCharacter(input.characterId);
    const assets = await this.assetStore.listByCharacterId(
      input.characterId,
      input.mediaType,
    );
    const limitedAssets =
      input.limit !== undefined ? assets.slice(0, input.limit) : assets;

    return mapAssetListResult("list_character_assets", profile, limitedAssets);
  }

  async createLiveAvatar(input: CreateLiveAvatarInput): Promise<OpenClawToolResult> {
    const avatar = await this.client.createLiveAvatar(input);
    return {
      ok: true,
      toolName: "create_live_avatar",
      summary: `Created live avatar ${avatar.name} (${avatar.id}) with status ${avatar.status ?? "unknown"}.`,
      data: { avatar },
      nextActions: ["get_live_avatar", "create_realtime_session"],
    };
  }

  async getLiveAvatar(input: GetLiveAvatarInput): Promise<OpenClawToolResult> {
    const avatar = await this.client.getLiveAvatar(input.avatarId);
    return {
      ok: true,
      toolName: "get_live_avatar",
      summary: `Fetched live avatar ${avatar.name} (${avatar.id}) with status ${avatar.status ?? "unknown"}.`,
      data: { avatar },
      nextActions: ["create_realtime_session"],
    };
  }

  async createRealtimeSession(input: CreateRealtimeSessionInput): Promise<OpenClawToolResult> {
    const session = await this.client.createRealtimeSession(input);
    return {
      ok: true,
      toolName: "create_realtime_session",
      summary: `Created realtime session ${session.id} for avatar ${input.avatarId}. Current status: ${session.status ?? "unknown"}.`,
      data: { session },
      nextActions: ["get_realtime_session", "wait_for_realtime_session"],
    };
  }

  async getRealtimeSession(input: GetRealtimeSessionInput): Promise<OpenClawToolResult> {
    const session = await this.client.getRealtimeSession(input.sessionId);
    return {
      ok: true,
      toolName: "get_realtime_session",
      summary: `Realtime session ${session.id} is ${session.status ?? "unknown"}.`,
      data: { session },
      nextActions:
        session.status === "READY"
          ? ["consume_realtime_session"]
          : ["wait_for_realtime_session"],
    };
  }

  async waitForRealtimeSession(input: WaitForRealtimeSessionInput): Promise<OpenClawToolResult> {
    const startedAt = Date.now();
    const pollIntervalMs = input.pollIntervalMs ?? 1000;
    const timeoutMs = input.timeoutMs ?? 60000;
    const maxAttempts = input.maxAttempts ?? Math.max(1, Math.ceil(timeoutMs / Math.max(1, pollIntervalMs)));

    let attempts = 0;
    while (attempts < maxAttempts && Date.now() - startedAt <= timeoutMs) {
      attempts += 1;
      const session = await this.client.getRealtimeSession(input.sessionId);
      if (session.status === "READY") {
        return {
          ok: true,
          toolName: "wait_for_realtime_session",
          summary: `Realtime session ${session.id} became READY after ${attempts} poll attempt(s).`,
          data: { session, attempts },
          nextActions: ["consume_realtime_session"],
        };
      }
      if (session.status === "FAILED" || session.status === "CANCELLED") {
        return {
          ok: false,
          toolName: "wait_for_realtime_session",
          summary: `Realtime session ${session.id} ended with status ${session.status}.`,
          data: { session, attempts },
          error: {
            code: session.status === "FAILED" ? "REALTIME_SESSION_FAILED" : "REALTIME_SESSION_CANCELLED",
            message: session.failure ?? `Realtime session ${session.id} ${session.status}.`,
            retryable: false,
          },
        };
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    const session = await this.client.getRealtimeSession(input.sessionId);
    return {
      ok: false,
      toolName: "wait_for_realtime_session",
      summary: `Realtime session ${session.id} did not become READY before timeout.`,
      data: { session, attempts },
      error: {
        code: "REALTIME_SESSION_TIMEOUT",
        message: `Timed out waiting for realtime session ${session.id} to become READY.`,
        retryable: true,
      },
    };
  }

  async consumeRealtimeSession(input: ConsumeRealtimeSessionInput): Promise<OpenClawToolResult> {
    const session = await this.client.getRealtimeSession(input.sessionId);
    const credentials = await this.client.consumeRealtimeSession(input.sessionId, session.sessionKey);
    return {
      ok: true,
      toolName: "consume_realtime_session",
      summary: `Consumed realtime session ${input.sessionId} and retrieved connection credentials.`,
      data: { session, credentials },
    };
  }

  async downloadGeneratedAsset(
    input: DownloadGeneratedAssetInput,
  ): Promise<OpenClawToolResult> {
    const asset = await this.assetStore.getById(input.assetId);

    if (!asset) {
      throw new NotFoundError(`Generated asset ${input.assetId} was not found.`, {
        assetId: input.assetId,
      });
    }

    const outputDir = path.resolve(input.outputDir ?? this.config.defaultOutputDir);
    await mkdir(outputDir, { recursive: true });
    const extension = asset.mediaType === "video" ? ".mp4" : ".png";
    const filePath = path.join(outputDir, `${asset.id}${extension}`);

    if (asset.localPath && !input.overwrite) {
      return {
        ok: true,
        toolName: "download_generated_asset",
        summary: `Asset ${asset.id} already exists locally at ${asset.localPath}.`,
        data: {
          asset,
          filePath: asset.localPath,
        },
      };
    }

    const buffer = await this.client.downloadAsset(asset.outputUrl);
    await writeFile(filePath, Buffer.from(buffer));
    const updatedAsset = {
      ...asset,
      localPath: filePath,
    };
    await this.assetStore.save(updatedAsset);

    return {
      ok: true,
      toolName: "download_generated_asset",
      summary: `Downloaded asset ${asset.id} to ${filePath}.`,
      data: {
        asset: updatedAsset,
        filePath,
      },
      nextActions: ["list_character_assets"],
    };
  }

  async refreshJob(
    jobId: string,
  ): Promise<{ job: import("./types.js").GenerationJob; assets: GeneratedAsset[] }> {
    const job = await this.requireJob(jobId);

    if (!job.providerJobId) {
      const assets = await this.assetStore.listByJobId(job.id);
      return { job, assets };
    }

    const providerResponse = await this.client.getGenerationJob(job.providerJobId);
    return this.syncJobWithProvider(job, providerResponse);
  }

  private async requireCharacter(characterId: string): Promise<CharacterProfile> {
    const profile = await this.characterStore.getById(characterId);

    if (!profile) {
      throw new NotFoundError(`Character profile ${characterId} was not found.`, {
        characterId,
      });
    }

    return profile;
  }

  private async ensureReferenceAssetsUploaded(
    profile: CharacterProfile,
  ): Promise<CharacterProfile> {
    let changed = false;
    const nextReferenceImages: CharacterProfile["referenceImages"] = [];

    for (const image of profile.referenceImages) {
      if (image.sourceType === "url") {
        nextReferenceImages.push(image);
        continue;
      }

      if (image.uploadedUri) {
        nextReferenceImages.push({
          ...image,
          source: image.uploadedUri,
          sourceType: "url" as const,
        });
        continue;
      }

      const uploaded = await this.client.uploadReferenceAsset({
        source: image.source,
        sourceType: image.sourceType,
        ...(image.label ? { label: image.label } : {}),
      });

      changed = true;
      nextReferenceImages.push({
        ...image,
        source: uploaded.url ?? image.source,
        sourceType: "url" as const,
        uploadedUri: uploaded.url,
        uploadedAt: nowIso(),
        ...(uploaded.id ? { providerAssetId: uploaded.id } : {}),
      });
    }

    if (!changed) {
      return profile;
    }

    const nextProfile = {
      ...profile,
      referenceImages: nextReferenceImages,
      updatedAt: nowIso(),
    };
    await this.characterStore.save(nextProfile);
    return nextProfile;
  }

  private async requireJob(jobId: string): Promise<import("./types.js").GenerationJob> {
    const localJob = await this.jobStore.getById(jobId);

    if (localJob) {
      return localJob;
    }

    const providerJob = await this.jobStore.findByProviderJobId(jobId);

    if (!providerJob) {
      throw new NotFoundError(`Generation job ${jobId} was not found.`, { jobId });
    }

    return providerJob;
  }

  private async submitJob(
    draftJob: import("./types.js").GenerationJob,
    request: import("./types.js").RunwayCreateGenerationJobRequest,
  ): Promise<{ job: import("./types.js").GenerationJob; assets: GeneratedAsset[] }> {
    const providerResponse = await this.client.createGenerationJob(request);
    const submittedJob = {
      ...draftJob,
      providerJobId: providerResponse.id,
      providerStatus: providerResponse.status,
      status: mapProviderStatus(providerResponse.status),
      updatedAt: nowIso(),
    };

    return this.syncJobWithProvider(submittedJob, providerResponse);
  }

  private buildReferenceFallbackPrompt(prompt: string, strategy: "small-variation-editorial" | "minimal-reference-lock"): string {
    if (strategy === "small-variation-editorial") {
      return "Ava Sterling editorial portrait, same person, tailored coat, subtle angle change, clean cinematic realism";
    }

    return "Ava Sterling portrait, same identity, same face, tailored coat";
  }

  private async tryReferenceImageFallback(
    job: import("./types.js").GenerationJob,
  ): Promise<{ job: import("./types.js").GenerationJob; assets: GeneratedAsset[] } | null> {
    const request = job.request;
    const metadata = (request.input.metadata ?? {}) as Record<string, unknown>;
    const triedStrategies = Array.isArray(metadata.fallbackStrategiesTried)
      ? metadata.fallbackStrategiesTried.filter((entry): entry is string => typeof entry === "string")
      : [];

    if (
      job.mediaType !== "image" ||
      request.type !== "image" ||
      request.input.references.length === 0
    ) {
      return null;
    }

    const fallbackOrder: Array<"small-variation-editorial" | "minimal-reference-lock"> = [
      "small-variation-editorial",
      "minimal-reference-lock",
    ];
    const nextStrategy = fallbackOrder.find((strategy) => !triedStrategies.includes(strategy));

    if (!nextStrategy) {
      return null;
    }

    const fallbackRequest = {
      ...request,
      input: {
        ...request.input,
        prompt: this.buildReferenceFallbackPrompt(request.input.prompt, nextStrategy),
        metadata: {
          ...metadata,
          fallbackStrategy: nextStrategy,
          fallbackSourceJobId: job.id,
          fallbackStrategiesTried: [...triedStrategies, nextStrategy],
        },
      },
    };

    const fallbackJob = {
      ...job,
      id: `fallback_${job.id}_${nextStrategy}`,
      providerJobId: undefined,
      providerStatus: undefined,
      status: "queued" as const,
      outputAssetIds: [],
      rawProviderResponse: undefined,
      error: undefined,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      completedAt: undefined,
      submittedAt: undefined,
      request: fallbackRequest,
      promptSnapshot: {
        ...job.promptSnapshot,
        prompt: fallbackRequest.input.prompt,
        resolvedPrompt: fallbackRequest.input.prompt,
      },
    };

    return this.submitJob(fallbackJob, fallbackRequest);
  }

  private async syncJobWithProvider(
    job: import("./types.js").GenerationJob,
    providerResponse: import("./types.js").RunwayGenerationJobResponse,
  ): Promise<{ job: import("./types.js").GenerationJob; assets: GeneratedAsset[] }> {
    const existingAssets = await this.assetStore.listByJobId(job.id);
    const mappedAssets = mapRunwayResponseToAssets(job, providerResponse);
    const persistedAssets: GeneratedAsset[] = [];

    for (const asset of mappedAssets) {
      const existing =
        (asset.providerAssetId
          ? await this.assetStore.findByProviderAssetId(asset.providerAssetId)
          : null) ??
        existingAssets.find((entry) => entry.outputUrl === asset.outputUrl) ??
        null;

      const toPersist = existing
        ? {
            ...existing,
            ...asset,
            id: existing.id,
            createdAt: existing.createdAt,
          }
        : asset;

      await this.assetStore.save(toPersist);
      persistedAssets.push(toPersist);
    }

    const finalAssets = persistedAssets.length > 0 ? persistedAssets : existingAssets;
    const syncedJob = mergeProviderJobState(job, providerResponse, finalAssets);
    await this.jobStore.save(syncedJob);

    return {
      job: syncedJob,
      assets: finalAssets,
    };
  }
}

export function createRunwayCharacterAdapter(
  configOverrides: Partial<RunwayAdapterConfig> = {},
  dependencies: RunwayCharacterAdapterDependencies = {},
): RunwayCharacterAdapter {
  return new RunwayCharacterAdapter(configOverrides, dependencies);
}
