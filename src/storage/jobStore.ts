import type { GenerationJob, JobStoreContract } from "../types.js";
import { FileStore } from "./fileStore.js";

export class JobStore extends FileStore<GenerationJob> implements JobStoreContract {
  async listByCharacterId(characterId: string): Promise<GenerationJob[]> {
    const jobs = await this.list();
    return jobs.filter((job) => job.characterId === characterId);
  }

  async listByContinuityBundleId(bundleId: string): Promise<GenerationJob[]> {
    const jobs = await this.list();
    return jobs.filter((job) => job.continuityBundleId === bundleId);
  }

  async findByProviderJobId(providerJobId: string): Promise<GenerationJob | null> {
    const jobs = await this.list();
    return jobs.find((job) => job.providerJobId === providerJobId) ?? null;
  }
}
