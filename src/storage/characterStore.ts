import type { CharacterProfile, CharacterStoreContract } from "../types.js";
import { FileStore } from "./fileStore.js";

export class CharacterStore
  extends FileStore<CharacterProfile>
  implements CharacterStoreContract {}
