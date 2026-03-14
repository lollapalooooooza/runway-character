import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createRunwayCharacterAdapter,
  registerRunwayCharacterTools,
} from "../src/index.js";
import {
  createCharacterProfilePayload,
  createFetchStub,
  createTaskAcceptedResponse,
  createTempConfig,
} from "./fixtures/factories.js";

describe("tool registration and handlers", () => {
  it("registers the full tool set", async () => {
    const config = await createTempConfig();
    const adapter = createRunwayCharacterAdapter({
      ...config,
      fetchFn: createFetchStub([]),
    });
    const registry = {
      tools: [] as string[],
      registerTool(definition: { name: string }) {
        this.tools.push(definition.name);
      },
    };

    registerRunwayCharacterTools(registry, adapter);

    expect(registry.tools).toHaveLength(18);
    expect(registry.tools).toContain("generate_storyboard_sequence");
  });

  it("converts long-form character knowledge into a profile draft", async () => {
    const config = await createTempConfig();
    const adapter = createRunwayCharacterAdapter({
      ...config,
      fetchFn: createFetchStub([]),
    });

    const result = await adapter.executeTool("ingest_character_knowledge", {
      sourceText: `
姓名: 林雾
外观概述: 冷静的东亚女性，黑色短发，琥珀色眼睛，深色长风衣。
性格: 克制、聪明、观察力强
服装:
- 深蓝长风衣
- 黑色高领毛衣
风格标签: cinematic, 写实, 电影感
一致性规则:
- 保持琥珀色眼睛
- 保持短黑发和利落轮廓
`,
    });

    expect(result.ok).toBe(true);
    const data = result.data as {
      profileDraft: {
        name: string;
        wardrobe?: string[];
        styleTags?: string[];
        continuityNotes?: string[];
      };
    };

    expect(data.profileDraft.name).toBe("林雾");
    expect(data.profileDraft.wardrobe).toContain("深蓝长风衣");
    expect(data.profileDraft.styleTags).toEqual(
      expect.arrayContaining(["cinematic", "写实", "电影感"]),
    );
    expect(data.profileDraft.continuityNotes?.length).toBeGreaterThan(0);
  });

  it("loads character knowledge from a local text file", async () => {
    const config = await createTempConfig();
    const adapter = createRunwayCharacterAdapter({
      ...config,
      fetchFn: createFetchStub([]),
    });

    const filePath = path.join(config.dataRootDir!, "character-knowledge.md");
    await mkdir(config.dataRootDir!, { recursive: true });
    await writeFile(
      filePath,
      "name: Iris Vale\nvisual summary: silver hair, green eyes, white coat\nwardrobe: white coat, black boots\n",
      "utf8",
    );

    const result = await adapter.executeTool("ingest_character_knowledge", {
      sourceFilePath: filePath,
    });

    expect(result.ok).toBe(true);
    const data = result.data as { profileDraft: { name: string; visualSummary?: string } };
    expect(data.profileDraft.name).toBe("Iris Vale");
    expect(data.profileDraft.visualSummary).toContain("silver hair");
  });

  it("creates a character profile directly from attachment paths", async () => {
    const config = await createTempConfig();
    const adapter = createRunwayCharacterAdapter({
      ...config,
      fetchFn: createFetchStub([]),
    });

    const filePath = path.join(config.dataRootDir!, "attachment-knowledge.md");
    await mkdir(config.dataRootDir!, { recursive: true });
    await writeFile(
      filePath,
      "姓名: 纪岚\n外观概述: 黑发，灰眼，长外套。\n服装: 长外套, 皮靴\n",
      "utf8",
    );

    const result = await adapter.executeTool("create_character_from_knowledge", {
      attachmentPaths: [filePath],
    });

    expect(result.ok).toBe(true);
    const data = result.data as {
      character: { name: string };
    };
    expect(data.character.name).toBe("纪岚");
  });

  it("creates a character profile directly from knowledge", async () => {
    const config = await createTempConfig();
    const adapter = createRunwayCharacterAdapter({
      ...config,
      fetchFn: createFetchStub([]),
    });

    const result = await adapter.executeTool("create_character_from_knowledge", {
      sourceText: `
姓名: 苏岚
外观概述: 银白短发，绿色眼睛，白色长外套。
性格: 冷静，专业，少说话
服装: 白色长外套, 黑色靴子
风格标签: editorial, cinematic
`,
    });

    expect(result.ok).toBe(true);
    const data = result.data as {
      character: { id: string; name: string };
      profileDraft: { styleTags?: string[] };
    };
    expect(data.character.id).toMatch(/^char_/);
    expect(data.character.name).toBe("苏岚");
    expect(data.profileDraft.styleTags).toEqual(
      expect.arrayContaining(["editorial", "cinematic"]),
    );
  });

  it("updates character metadata, styles, and references", async () => {
    const config = await createTempConfig();
    const adapter = createRunwayCharacterAdapter({
      ...config,
      fetchFn: createFetchStub([]),
    });

    const createResult = await adapter.executeTool(
      "create_character_profile",
      createCharacterProfilePayload(),
    );
    const createData = createResult.data as {
      character: { id: string; referenceImages: Array<{ id: string }> };
    };

    const updateResult = await adapter.executeTool("update_character_profile", {
      characterId: createData.character.id,
      metadata: {
        personality: "Sharp, restrained, observant.",
      },
      addReferenceImages: [
        {
          sourceType: "url",
          source: "https://assets.example.com/ava-side.jpg",
          role: "secondary",
        },
      ],
      removeReferenceImageIds: [createData.character.referenceImages[0]!.id],
      styleConstraints: {
        styleTags: ["low key", "editorial"],
        visualLanguage: "glossy urban realism",
      },
      continuityNote: "Keep the left cheek scar consistent.",
    });

    expect(updateResult.ok).toBe(true);
    const updatedCharacter = (updateResult.data as {
      character: {
        referenceImages: unknown[];
        continuityNotes: unknown[];
        styleTags: string[];
        visualLanguage: string;
      };
    }).character;

    expect(updatedCharacter.referenceImages).toHaveLength(1);
    expect(updatedCharacter.continuityNotes).toHaveLength(2);
    expect(updatedCharacter.styleTags).toEqual(["low key", "editorial"]);
    expect(updatedCharacter.visualLanguage).toBe("glossy urban realism");
  });

  it("submits storyboard jobs under one continuity bundle", async () => {
    const config = await createTempConfig();
    const fetchFn = createFetchStub([
      { body: createTaskAcceptedResponse("rw_story_1") },
      { body: createTaskAcceptedResponse("rw_story_2") },
    ]);
    const adapter = createRunwayCharacterAdapter({ ...config, fetchFn });

    const createResult = await adapter.executeTool(
      "create_character_profile",
      createCharacterProfilePayload(),
    );
    const characterId = (createResult.data as { character: { id: string } }).character.id;

    const storyboardResult = await adapter.executeTool(
      "generate_storyboard_sequence",
      {
        characterId,
        sequenceName: "intro-sequence",
        commonContinuityNotes: ["Keep the trench coat wet from rain."],
        shots: [
          {
            title: "wide rooftop",
            prompt: "Ava steps onto the rooftop, city lights behind her.",
            mediaType: "image",
            framing: "wide shot",
          },
          {
            title: "push in",
            prompt: "Ava looks over her shoulder toward camera.",
            mediaType: "video",
            shotType: "medium close-up",
            cameraMotion: "slow push in",
            durationSeconds: 4,
            fps: 24,
          },
        ],
      },
    );

    expect(storyboardResult.ok).toBe(true);
    const data = storyboardResult.data as {
      bundleId: string;
      shots: Array<{ jobId: string }>;
    };

    expect(data.bundleId).toMatch(/^bundle_/);
    expect(data.shots).toHaveLength(2);
    const jobs = await adapter.jobStore.listByContinuityBundleId(data.bundleId);
    expect(jobs).toHaveLength(2);
  });
});
