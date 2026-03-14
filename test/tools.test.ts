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

    expect(registry.tools).toHaveLength(10);
    expect(registry.tools).toContain("generate_storyboard_sequence");
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
