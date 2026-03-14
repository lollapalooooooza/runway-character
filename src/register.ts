import type { RunwayCharacterAdapter } from "./adapter.js";
import type { OpenClawToolRegistry } from "./types.js";

export function registerRunwayCharacterTools(
  registry: OpenClawToolRegistry,
  adapter: RunwayCharacterAdapter,
): void {
  for (const tool of adapter.getToolDefinitions()) {
    registry.registerTool(tool);
  }
}
