import { describe, expect, it, vi } from "vitest";

import registerPlugin from "../src/plugin.js";

describe("OpenClaw plugin registration", () => {
  it("registers tools even when the API key is missing", () => {
    const registerTool = vi.fn();
    const info = vi.fn();
    const warn = vi.fn();

    registerPlugin({
      config: {
        plugins: {
          entries: {
            "runway-character": {
              config: {
                dataRootDir: "./data",
                optionalTools: true,
              },
            },
          },
        },
      },
      logger: { info, warn },
      resolvePath: (input: string) => input,
      registerTool,
    });

    expect(registerTool).toHaveBeenCalled();
    expect(registerTool.mock.calls).toHaveLength(10);
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("Missing API key"),
    );
    expect(warn).not.toHaveBeenCalled();
  });
});
