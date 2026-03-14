import { afterEach, describe, expect, it } from "vitest";

import { createRunwayCharacterApiServer } from "../src/server.js";
import { createTempConfig } from "./fixtures/factories.js";

const runningStops: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (runningStops.length > 0) {
    const stop = runningStops.pop();
    if (stop) {
      await stop();
    }
  }
});

describe("Runway character HTTP API", () => {
  it("creates a character from JSON knowledge input", async () => {
    const config = await createTempConfig();
    const api = createRunwayCharacterApiServer({
      adapterConfig: {
        ...config,
        apiKey: undefined,
      },
      port: 0,
    });
    runningStops.push(api.stop);

    const { port, host } = await api.start();
    const response = await fetch(`http://${host}:${port}/api/characters/from-knowledge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourceText: "姓名: 夜阑\n外观概述: 黑发，灰眼，长风衣。\n服装: 长风衣, 皮靴",
      }),
    });

    expect(response.status).toBe(200);
    const result = (await response.json()) as {
      ok: boolean;
      data: { character: { name: string } };
    };
    expect(result.ok).toBe(true);
    expect(result.data.character.name).toBe("夜阑");
  });

  it("accepts multipart file upload", async () => {
    const config = await createTempConfig();
    const api = createRunwayCharacterApiServer({
      adapterConfig: {
        ...config,
        apiKey: undefined,
      },
      port: 0,
    });
    runningStops.push(api.stop);

    const { port, host } = await api.start();
    const form = new FormData();
    form.set(
      "file",
      new File(
        ["name: Mira\nvisual summary: silver hair, blue eyes, white jacket\n"],
        "mira.md",
        { type: "text/markdown" },
      ),
    );

    const response = await fetch(`http://${host}:${port}/api/characters/from-knowledge`, {
      method: "POST",
      body: form,
    });

    expect(response.status).toBe(200);
    const result = (await response.json()) as {
      ok: boolean;
      data: { character: { name: string } };
    };
    expect(result.ok).toBe(true);
    expect(result.data.character.name).toBe("Mira");
  });
});
