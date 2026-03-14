import type {
  GetGenerationJobInput,
  OpenClawToolDefinition,
  RunwayToolContext,
} from "../types.js";
import { readRecord, readString } from "../utils/guards.js";

function parseGetGenerationJobInput(input: unknown): GetGenerationJobInput {
  const record = readRecord(input, "get_generation_job input");

  return {
    jobId: readString(record.jobId, "jobId"),
  };
}

export function getGenerationJobTool(
  context: RunwayToolContext,
): OpenClawToolDefinition<GetGenerationJobInput> {
  return {
    name: "get_generation_job",
    description: "Refresh and return the normalized state of a generation job.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["jobId"],
      properties: {
        jobId: { type: "string" },
      },
    },
    parse: parseGetGenerationJobInput,
    handler: async (input) => context.getGenerationJob(input),
  };
}
