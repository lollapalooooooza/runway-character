import { describe, expect, it, vi } from "vitest";

const executeTool = vi.fn();
const close = vi.fn(async () => {});

vi.mock("../src/adapter.js", () => ({
  createRunwayCharacterAdapter: () => ({
    executeTool,
    close,
  }),
}));

describe("character consistency smoke suite", () => {
  it("returns a structured summary with failed and successful strategy attempts", async () => {
    executeTool.mockReset();
    close.mockClear();

    executeTool
      .mockResolvedValueOnce({ ok: true, toolName: "create_character_profile", summary: "created", data: { character: { id: "char_1" } } })
      .mockResolvedValueOnce({ ok: true, toolName: "update_character_profile", summary: "updated" })
      .mockResolvedValueOnce({ ok: true, toolName: "generate_character_image", summary: "gen1", data: { rawJob: { id: "job_1" } } })
      .mockResolvedValueOnce({ ok: true, toolName: "wait_for_generation_job", summary: "wait1", data: { assets: [{ id: "asset_1", outputUrl: "https://cdn.example.com/a.png" }] } })
      .mockResolvedValueOnce({ ok: true, toolName: "update_character_profile", summary: "add reference" })
      .mockResolvedValueOnce({ ok: true, toolName: "download_generated_asset", summary: "download1", data: { filePath: "/tmp/asset_1.png" } })
      .mockResolvedValueOnce({ ok: false, toolName: "generate_character_image", summary: "strategy1 submit failed", error: { code: "UPSTREAM_API_ERROR", message: "bad", retryable: false } })
      .mockResolvedValueOnce({ ok: true, toolName: "generate_character_image", summary: "strategy2 submit ok", data: { rawJob: { id: "job_2" } } })
      .mockResolvedValueOnce({ ok: false, toolName: "wait_for_generation_job", summary: "strategy2 wait failed", error: { code: "JOB_FAILED", message: "boom", retryable: false } })
      .mockResolvedValueOnce({ ok: true, toolName: "generate_character_image", summary: "strategy3 submit ok", data: { rawJob: { id: "job_3" } } })
      .mockResolvedValueOnce({ ok: true, toolName: "wait_for_generation_job", summary: "strategy3 wait ok", data: { assets: [{ id: "asset_2" }] } })
      .mockResolvedValueOnce({ ok: true, toolName: "download_generated_asset", summary: "download2", data: { filePath: "/tmp/asset_2.png" } });

    const { runCharacterConsistencySmoke } = await import("../src/characterConsistencySmoke.js");
    const result = await runCharacterConsistencySmoke({ name: "Ava Test" });

    expect(result.ok).toBe(true);
    expect(result.characterId).toBe("char_1");
    expect(result.firstJobId).toBe("job_1");
    expect(result.firstAssetId).toBe("asset_1");
    expect(result.firstDownloadPath).toBe("/tmp/asset_1.png");
    expect(result.secondStageStatus).toBe("succeeded");
    expect(result.successfulStrategy).toBe("minimal-reference-lock");
    expect(result.attempts).toHaveLength(3);
    expect(result.attempts[0]?.ok).toBe(false);
    expect(result.attempts[1]?.stage).toBe("wait");
    expect(result.attempts[2]?.downloadPath).toBe("/tmp/asset_2.png");
    expect(close).toHaveBeenCalled();
  });
});
