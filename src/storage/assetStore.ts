import type {
  AssetStoreContract,
  GeneratedAsset,
  GeneratedMediaType,
} from "../types.js";
import { FileStore } from "./fileStore.js";

export class AssetStore
  extends FileStore<GeneratedAsset>
  implements AssetStoreContract
{
  async listByCharacterId(
    characterId: string,
    mediaType?: GeneratedMediaType,
  ): Promise<GeneratedAsset[]> {
    const assets = await this.list();

    return assets.filter(
      (asset) =>
        asset.characterId === characterId &&
        (mediaType === undefined || asset.mediaType === mediaType),
    );
  }

  async listByJobId(jobId: string): Promise<GeneratedAsset[]> {
    const assets = await this.list();
    return assets.filter((asset) => asset.jobId === jobId);
  }

  async findByProviderAssetId(providerAssetId: string): Promise<GeneratedAsset | null> {
    const assets = await this.list();
    return assets.find((asset) => asset.providerAssetId === providerAssetId) ?? null;
  }
}
