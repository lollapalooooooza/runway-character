import { createRunwayCharacterAdapter } from "./adapter.js";
import type { OpenClawToolResult } from "./types.js";

export interface CharacterConsistencySmokeOptions {
  name?: string;
  dataRootDir?: string;
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  pollIntervalMs?: number;
  defaultAspectRatio?: string;
  debug?: boolean;
  useLocalStore?: boolean;
}

export interface CharacterConsistencyProbeAttempt {
  strategy: string;
  prompt: string;
  ok: boolean;
  stage: "submit" | "wait";
  jobId?: string;
  assetId?: string;
  downloadPath?: string;
  summary: string;
  error?: unknown;
}

export interface CharacterConsistencySmokeSummary {
  ok: boolean;
  characterId?: string;
  firstJobId?: string;
  firstAssetId?: string;
  firstDownloadPath?: string;
  secondStageStatus: "succeeded" | "failed" | "skipped";
  successfulStrategy?: string;
  attempts: CharacterConsistencyProbeAttempt[];
  steps: Array<{
    step: string;
    ok: boolean;
    summary: string;
  }>;
  details: Record<string, unknown>;
}

function summarizeStep(step: string, result: OpenClawToolResult) {
  return {
    step,
    ok: result.ok,
    summary: result.summary,
  };
}

const SECOND_PASS_STRATEGIES = [
  {
    name: "same-identity-light-change",
    prompt:
      "Ava Sterling, same face and identity, tailored coat, close-up portrait, dramatic studio lighting, confident expression",
    framing: "close-up",
    lighting: "dramatic studio lighting",
    mood: "confident",
  },
  {
    name: "small-variation-editorial",
    prompt:
      "Ava Sterling editorial portrait, same person, tailored coat, subtle angle change, clean cinematic realism",
    framing: "medium close-up",
    lighting: "clean editorial lighting",
    mood: "composed",
  },
  {
    name: "minimal-reference-lock",
    prompt: "Ava Sterling portrait, same identity, same face, tailored coat",
    framing: "medium close-up",
    lighting: "soft studio lighting",
    mood: "neutral",
  },
] as const;

export async function runCharacterConsistencySmoke(
  options: CharacterConsistencySmokeOptions = {},
): Promise<CharacterConsistencySmokeSummary> {
  const adapter = createRunwayCharacterAdapter({
    ...(options.apiKey ? { apiKey: options.apiKey } : {}),
    ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    ...(options.maxRetries !== undefined ? { maxRetries: options.maxRetries } : {}),
    ...(options.pollIntervalMs !== undefined ? { pollIntervalMs: options.pollIntervalMs } : {}),
    ...(options.defaultAspectRatio ? { defaultAspectRatio: options.defaultAspectRatio } : {}),
    ...(options.debug !== undefined ? { debug: options.debug } : {}),
    ...(options.useLocalStore !== undefined ? { useLocalStore: options.useLocalStore } : {}),
    ...(options.dataRootDir ? { dataRootDir: options.dataRootDir } : {}),
  });

  const steps: CharacterConsistencySmokeSummary["steps"] = [];
  const details: Record<string, unknown> = {};
  const attempts: CharacterConsistencyProbeAttempt[] = [];

  try {
    const create = await adapter.executeTool("create_character_profile", {
      name: options.name ?? "Ava Sterling Consistency Smoke",
      visualSummary: "short black hair, amber eyes, tailored coat",
      hair: "short black hair",
      face: "amber eyes",
      wardrobe: ["tailored coat"],
      styleTags: ["cinematic", "clean portrait"],
      continuityNotes: ["Keep amber eyes and tailored coat consistent."],
    });
    steps.push(summarizeStep("create_character_profile", create));
    details.create = create;
    if (!create.ok) {
      return { ok: false, secondStageStatus: "skipped", attempts, steps, details };
    }

    const characterId = (create.data as { character: { id: string } }).character.id;

    const update = await adapter.executeTool("update_character_profile", {
      characterId,
      metadata: { personality: "composed, sharp, observant" },
      continuityNote: "Maintain a poised editorial portrait look.",
    });
    steps.push(summarizeStep("update_character_profile", update));
    details.update = update;
    if (!update.ok) {
      return { ok: false, characterId, secondStageStatus: "skipped", attempts, steps, details };
    }

    const gen1 = await adapter.executeTool("generate_character_image", {
      characterId,
      prompt:
        "Ava Sterling portrait, short black hair, amber eyes, tailored coat, cinematic realistic character portrait",
      aspectRatio: "16:9",
      framing: "medium close-up",
      lighting: "soft cinematic lighting",
      mood: "composed",
    });
    steps.push(summarizeStep("generate_character_image:first", gen1));
    details.gen1 = gen1;
    if (!gen1.ok) {
      return { ok: false, characterId, secondStageStatus: "skipped", attempts, steps, details };
    }

    const firstJobId = (gen1.data as { rawJob: { id: string } }).rawJob.id;
    const wait1 = await adapter.executeTool("wait_for_generation_job", {
      jobId: firstJobId,
      timeoutMs: 120000,
      pollIntervalMs: 3000,
      maxAttempts: 50,
    });
    steps.push(summarizeStep("wait_for_generation_job:first", wait1));
    details.wait1 = wait1;
    if (!wait1.ok) {
      return { ok: false, characterId, firstJobId, secondStageStatus: "skipped", attempts, steps, details };
    }

    const firstAsset = (wait1.data as { assets: Array<{ id: string; outputUrl: string }> }).assets[0];
    if (!firstAsset) {
      return {
        ok: false,
        characterId,
        firstJobId,
        secondStageStatus: "skipped",
        attempts,
        steps,
        details: {
          ...details,
          firstAssetError: "wait_for_generation_job returned no assets for first generation",
        },
      };
    }

    const updateRef = await adapter.executeTool("update_character_profile", {
      characterId,
      addReferenceImages: [
        {
          sourceType: "url",
          source: firstAsset.outputUrl,
          role: "primary",
          label: "generated reference",
        },
      ],
      continuityNote: "Use the generated portrait as the primary facial reference.",
    });
    steps.push(summarizeStep("update_character_profile:add_reference", updateRef));
    details.updateRef = updateRef;

    const download1 = await adapter.executeTool("download_generated_asset", {
      assetId: firstAsset.id,
      overwrite: true,
    });
    steps.push(summarizeStep("download_generated_asset:first", download1));
    details.download1 = download1;
    const firstDownloadPath = download1.ok
      ? (download1.data as { filePath: string }).filePath
      : undefined;

    if (!updateRef.ok) {
      return {
        ok: false,
        characterId,
        firstJobId,
        firstAssetId: firstAsset.id,
        firstDownloadPath,
        secondStageStatus: "skipped",
        attempts,
        steps,
        details,
      };
    }

    let secondStageStatus: CharacterConsistencySmokeSummary["secondStageStatus"] = "failed";
    let successfulStrategy: string | undefined;

    for (const strategy of SECOND_PASS_STRATEGIES) {
      const gen = await adapter.executeTool("generate_character_image", {
        characterId,
        prompt: strategy.prompt,
        aspectRatio: "16:9",
        framing: strategy.framing,
        lighting: strategy.lighting,
        mood: strategy.mood,
      });
      steps.push(summarizeStep(`generate_character_image:${strategy.name}`, gen));
      details[`gen2_${strategy.name}`] = gen;

      if (!gen.ok) {
        attempts.push({
          strategy: strategy.name,
          prompt: strategy.prompt,
          ok: false,
          stage: "submit",
          summary: gen.summary,
          error: gen.error,
        });
        continue;
      }

      const jobId = (gen.data as { rawJob: { id: string } }).rawJob.id;
      const wait = await adapter.executeTool("wait_for_generation_job", {
        jobId,
        timeoutMs: 120000,
        pollIntervalMs: 3000,
        maxAttempts: 50,
      });
      steps.push(summarizeStep(`wait_for_generation_job:${strategy.name}`, wait));
      details[`wait2_${strategy.name}`] = wait;

      if (!wait.ok) {
        attempts.push({
          strategy: strategy.name,
          prompt: strategy.prompt,
          ok: false,
          stage: "wait",
          jobId,
          summary: wait.summary,
          error: wait.error,
        });
        continue;
      }

      const secondAsset = (wait.data as { assets: Array<{ id: string }> }).assets[0];
      let downloadPath: string | undefined;
      if (secondAsset?.id) {
        const download2 = await adapter.executeTool("download_generated_asset", {
          assetId: secondAsset.id,
          overwrite: true,
        });
        steps.push(summarizeStep(`download_generated_asset:${strategy.name}`, download2));
        details[`download2_${strategy.name}`] = download2;
        if (download2.ok) {
          downloadPath = (download2.data as { filePath: string }).filePath;
        }
      }

      attempts.push({
        strategy: strategy.name,
        prompt: strategy.prompt,
        ok: true,
        stage: "wait",
        jobId,
        assetId: secondAsset?.id,
        downloadPath,
        summary: wait.summary,
      });
      secondStageStatus = "succeeded";
      successfulStrategy = strategy.name;
      break;
    }

    return {
      ok: create.ok && update.ok && gen1.ok && wait1.ok,
      characterId,
      firstJobId,
      firstAssetId: firstAsset.id,
      firstDownloadPath,
      secondStageStatus,
      successfulStrategy,
      attempts,
      steps,
      details,
    };
  } finally {
    await adapter.close();
  }
}
