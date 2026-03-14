export type JsonPrimitive = string | number | boolean | null;

export interface JsonObject {
  [key: string]: JsonValue;
}

export interface JsonArray extends Array<JsonValue> {}

export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type JsonSchema = Readonly<Record<string, unknown>>;
export type FetchLike = typeof fetch;

export interface NormalizedAdapterError {
  code: string;
  message: string;
  retryable: boolean;
  statusCode?: number;
  details?: Record<string, unknown>;
}

export interface OpenClawToolCallInput<TArguments = unknown> {
  name: string;
  arguments: TArguments;
  requestId?: string;
  sessionId?: string;
  metadata?: JsonObject;
}

export interface OpenClawToolResult<TPayload = unknown> {
  ok: boolean;
  toolName: string;
  summary: string;
  data?: TPayload;
  error?: NormalizedAdapterError;
  nextActions?: string[];
  metadata?: JsonObject;
}

export interface OpenClawToolDefinition<TInput = unknown, TPayload = unknown> {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  parse(input: unknown): TInput;
  handler(input: TInput): Promise<OpenClawToolResult<TPayload>>;
}

export interface OpenClawToolRegistry {
  registerTool(definition: OpenClawToolDefinition): void;
}

export type CharacterReferenceSourceType = "upload" | "url" | "local";
export type CharacterReferenceRole =
  | "primary"
  | "secondary"
  | "expression"
  | "wardrobe"
  | "pose"
  | "motion";

export interface CharacterReferenceImage {
  id: string;
  characterId: string;
  sourceType: CharacterReferenceSourceType;
  source: string;
  label?: string;
  role: CharacterReferenceRole;
  notes?: string;
  weight: number;
  createdAt: string;
  uploadedUri?: string;
  uploadedAt?: string;
  providerAssetId?: string;
}

export interface CharacterContinuityNote {
  id: string;
  note: string;
  sourceJobId?: string;
  createdAt: string;
}

export interface CharacterProfile {
  id: string;
  name: string;
  slug: string;
  description?: string;
  visualSummary?: string;
  ageRange?: string;
  genderPresentation?: string;
  ethnicityOrAppearanceNotes?: string;
  hair?: string;
  face?: string;
  bodyType?: string;
  wardrobe: string[];
  accessories: string[];
  personality?: string;
  voiceNotes?: string;
  styleTags: string[];
  cinematicUniverse?: string;
  mood?: string;
  visualLanguage?: string;
  consistencyRules: string[];
  referenceImages: CharacterReferenceImage[];
  continuityNotes: CharacterContinuityNote[];
  createdAt: string;
  updatedAt: string;
}

export type GeneratedMediaType = "image" | "video";
export type GenerationJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "unknown";

export interface PromptSnapshot {
  prompt: string;
  resolvedPrompt?: string;
  negativePrompt?: string;
  aspectRatio: string;
  framing?: string;
  cameraLanguage?: string;
  lens?: string;
  lighting?: string;
  mood?: string;
  environment?: string;
  motionPrompt?: string;
  shotType?: string;
  cameraMotion?: string;
  durationSeconds?: number;
  fps?: number;
  continuityInstructions: string[];
  referenceImageIds: string[];
  variants: number;
  referenceStrength?: number;
  seed?: number;
  outputName?: string;
}

export interface GeneratedAsset {
  id: string;
  jobId: string;
  characterId: string;
  continuityBundleId?: string;
  mediaType: GeneratedMediaType;
  outputUrl: string;
  thumbnailUrl?: string;
  localPath?: string;
  providerAssetId?: string;
  promptSnapshot: PromptSnapshot;
  generationMetadata: JsonObject;
  createdAt: string;
}

export interface GenerationJob {
  id: string;
  providerJobId?: string;
  characterId: string;
  continuityBundleId?: string;
  mediaType: GeneratedMediaType;
  status: GenerationJobStatus;
  providerStatus?: string;
  promptSnapshot: PromptSnapshot;
  request: RunwayCreateGenerationJobRequest;
  outputAssetIds: string[];
  rawProviderResponse?: JsonValue;
  error?: {
    code?: string;
    message: string;
    retryable?: boolean;
    details?: JsonObject;
  };
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  completedAt?: string;
}

export interface StoryboardShot {
  id: string;
  bundleId: string;
  characterId: string;
  title?: string;
  mediaType: GeneratedMediaType;
  prompt: string;
  negativePrompt?: string;
  framing?: string;
  shotType?: string;
  cameraLanguage?: string;
  cameraMotion?: string;
  lighting?: string;
  mood?: string;
  environment?: string;
  durationSeconds?: number;
  fps?: number;
  continuityNotes: string[];
  jobId?: string;
  status?: GenerationJobStatus;
}

export interface RunwayApiPaths {
  createGenerationJob: string;
  getGenerationJob: (providerJobId: string) => string;
  cancelGenerationJob: (providerJobId: string) => string;
  uploadAsset: string;
}

export interface RunwayAdapterConfig {
  apiKey?: string;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  pollIntervalMs: number;
  defaultAspectRatio: string;
  defaultOutputDir: string;
  debug: boolean;
  useLocalStore: boolean;
  dataRootDir: string;
  charactersDir: string;
  assetsDir: string;
  jobsDir: string;
  apiPaths: RunwayApiPaths;
  fetchFn?: FetchLike;
}

export interface RunwayApiRequest<TBody = JsonObject> {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: TBody;
}

export interface RunwayApiResponse<TPayload = unknown> {
  status: number;
  requestId?: string;
  data: TPayload;
  raw?: unknown;
}

export interface RunwayReferenceAsset {
  source: string;
  sourceType: CharacterReferenceSourceType;
  label?: string;
  role: CharacterReferenceRole;
  notes?: string;
  weight?: number;
  remoteAssetId?: string;
}

export interface RunwayCreateGenerationJobRequest {
  type: GeneratedMediaType;
  input: {
    prompt: string;
    negativePrompt?: string;
    aspectRatio: string;
    framing?: string;
    cameraLanguage?: string;
    lens?: string;
    lighting?: string;
    mood?: string;
    environment?: string;
    motionPrompt?: string;
    shotType?: string;
    cameraMotion?: string;
    durationSeconds?: number;
    fps?: number;
    variants: number;
    seed?: number;
    referenceStrength?: number;
    continuityInstructions: string[];
    references: RunwayReferenceAsset[];
    metadata?: JsonObject;
  };
}

export interface RunwayGeneratedAssetResponse {
  id?: string;
  assetId?: string;
  mediaType?: string;
  type?: string;
  url?: string;
  outputUrl?: string;
  uri?: string;
  thumbnailUrl?: string;
  localPath?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  fps?: number;
  fileName?: string;
  metadata?: JsonObject;
}

export interface RunwayGenerationJobResponse {
  id: string;
  taskId?: string;
  jobId?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  requestId?: string;
  assets?: RunwayGeneratedAssetResponse[];
  output?: {
    assets?: RunwayGeneratedAssetResponse[];
    thumbnailUrl?: string;
    metadata?: JsonObject;
  };
  error?: {
    code?: string;
    message?: string;
    retryable?: boolean;
    details?: JsonObject;
  };
  metadata?: JsonObject;
  raw?: JsonValue;
}

export interface RunwayUploadReferenceAssetRequest {
  source: string;
  sourceType: CharacterReferenceSourceType;
  label?: string;
}

export interface RunwayUploadReferenceAssetResponse {
  id: string;
  url?: string;
  label?: string;
  metadata?: JsonObject;
}

export interface RunwayCharacterMetadataResponse {
  id: string;
  status: string;
  metadata?: JsonObject;
}

export interface CreateCharacterReferenceImageInput {
  sourceType: CharacterReferenceSourceType;
  source: string;
  label?: string;
  role?: CharacterReferenceRole;
  notes?: string;
  weight?: number;
}

export interface CreateCharacterProfileInput {
  name: string;
  description?: string;
  visualSummary?: string;
  ageRange?: string;
  genderPresentation?: string;
  ethnicityOrAppearanceNotes?: string;
  hair?: string;
  face?: string;
  bodyType?: string;
  wardrobe?: string[];
  accessories?: string[];
  personality?: string;
  voiceNotes?: string;
  styleTags?: string[];
  cinematicUniverse?: string;
  mood?: string;
  visualLanguage?: string;
  consistencyRules?: string[];
  referenceImages?: CreateCharacterReferenceImageInput[];
  continuityNotes?: string[];
}

export interface EditableCharacterProfileFields {
  description?: string;
  visualSummary?: string;
  ageRange?: string;
  genderPresentation?: string;
  ethnicityOrAppearanceNotes?: string;
  hair?: string;
  face?: string;
  bodyType?: string;
  wardrobe?: string[];
  accessories?: string[];
  personality?: string;
  voiceNotes?: string;
  styleTags?: string[];
  cinematicUniverse?: string;
  mood?: string;
  visualLanguage?: string;
  consistencyRules?: string[];
}

export interface UpdateCharacterProfileInput {
  characterId: string;
  metadata?: EditableCharacterProfileFields;
  addReferenceImages?: CreateCharacterReferenceImageInput[];
  removeReferenceImageIds?: string[];
  styleConstraints?: {
    styleTags?: string[];
    consistencyRules?: string[];
    cinematicUniverse?: string;
    mood?: string;
    visualLanguage?: string;
  };
  continuityNote?: string;
  continuityNotesToAdd?: string[];
}

export interface GetCharacterProfileInput {
  characterId: string;
}

export interface GenerateCharacterImageInput {
  characterId: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  framing?: string;
  cameraLanguage?: string;
  lens?: string;
  lighting?: string;
  mood?: string;
  environment?: string;
  referenceStrength?: number;
  consistencyHints?: string[];
  variants?: number;
  seed?: number;
  shotLabel?: string;
}

export interface GenerateCharacterVideoInput {
  characterId: string;
  scenePrompt: string;
  motionPrompt?: string;
  negativePrompt?: string;
  shotType?: string;
  cameraMotion?: string;
  cameraLanguage?: string;
  durationSeconds?: number;
  fps?: number;
  aspectRatio?: string;
  lighting?: string;
  mood?: string;
  environment?: string;
  continuityConstraints?: string[];
  variants?: number;
  seed?: number;
  shotLabel?: string;
}

export interface StoryboardShotInput {
  title?: string;
  mediaType?: GeneratedMediaType;
  prompt: string;
  negativePrompt?: string;
  framing?: string;
  shotType?: string;
  cameraLanguage?: string;
  cameraMotion?: string;
  lighting?: string;
  mood?: string;
  environment?: string;
  durationSeconds?: number;
  fps?: number;
  continuityNotes?: string[];
  variants?: number;
  seed?: number;
}

export interface GenerateStoryboardSequenceInput {
  characterId: string;
  sequenceName?: string;
  aspectRatio?: string;
  commonContinuityNotes?: string[];
  shots: StoryboardShotInput[];
}

export interface GetGenerationJobInput {
  jobId: string;
}

export interface WaitForGenerationJobInput {
  jobId: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
  maxAttempts?: number;
}

export interface ListCharacterAssetsInput {
  characterId: string;
  mediaType?: GeneratedMediaType;
  limit?: number;
}

export interface DownloadGeneratedAssetInput {
  assetId: string;
  outputDir?: string;
  overwrite?: boolean;
}

export interface EntityStore<T extends { id: string }> {
  create(entity: T): Promise<T>;
  save(entity: T): Promise<T>;
  getById(id: string): Promise<T | null>;
  update(id: string, updater: (current: T) => T): Promise<T>;
  list(): Promise<T[]>;
  delete(id: string): Promise<void>;
}

export interface CharacterStoreContract extends EntityStore<CharacterProfile> {}

export interface AssetStoreContract extends EntityStore<GeneratedAsset> {
  listByCharacterId(
    characterId: string,
    mediaType?: GeneratedMediaType,
  ): Promise<GeneratedAsset[]>;
  listByJobId(jobId: string): Promise<GeneratedAsset[]>;
  findByProviderAssetId(providerAssetId: string): Promise<GeneratedAsset | null>;
}

export interface JobStoreContract extends EntityStore<GenerationJob> {
  listByCharacterId(characterId: string): Promise<GenerationJob[]>;
  listByContinuityBundleId(bundleId: string): Promise<GenerationJob[]>;
  findByProviderJobId(providerJobId: string): Promise<GenerationJob | null>;
}

export interface LiveAvatarResponse {
  id: string;
  name: string;
  status?: string;
  personality?: string;
  startScript?: string | null;
  referenceImageUri?: string | null;
  processedImageUri?: string | null;
  voice?: JsonObject;
  createdAt?: string;
  updatedAt?: string;
  failureReason?: string;
  raw?: JsonValue;
}

export interface CreateLiveAvatarInput {
  name: string;
  referenceImage: string;
  personality: string;
  voicePresetId: string;
  startScript?: string;
}

export interface GetLiveAvatarInput {
  avatarId: string;
}

export interface RealtimeSessionResponse {
  id: string;
  status?: string;
  sessionKey?: string;
  failure?: string;
  avatarId?: string;
  raw?: JsonValue;
}

export interface CreateRealtimeSessionInput {
  avatarId: string;
}

export interface GetRealtimeSessionInput {
  sessionId: string;
}

export interface ConsumeRealtimeSessionInput {
  sessionId: string;
}

export interface WaitForRealtimeSessionInput {
  sessionId: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
  maxAttempts?: number;
}

export interface RealtimeSessionCredentials {
  url?: string;
  token?: string;
  roomName?: string;
  sessionId?: string;
  raw?: JsonValue;
}

export interface RunwayClientContract {
  createGenerationJob(
    payload: RunwayCreateGenerationJobRequest,
  ): Promise<RunwayGenerationJobResponse>;
  getGenerationJob(providerJobId: string): Promise<RunwayGenerationJobResponse>;
  cancelGenerationJob(providerJobId: string): Promise<RunwayGenerationJobResponse>;
  uploadReferenceAsset(
    payload: RunwayUploadReferenceAssetRequest,
  ): Promise<RunwayUploadReferenceAssetResponse>;
  downloadAsset(url: string): Promise<ArrayBuffer>;
  upsertCharacterMetadata(
    profile: CharacterProfile,
  ): Promise<RunwayCharacterMetadataResponse>;
  createLiveAvatar(input: CreateLiveAvatarInput): Promise<LiveAvatarResponse>;
  getLiveAvatar(avatarId: string): Promise<LiveAvatarResponse>;
  createRealtimeSession(input: CreateRealtimeSessionInput): Promise<RealtimeSessionResponse>;
  getRealtimeSession(sessionId: string): Promise<RealtimeSessionResponse>;
  consumeRealtimeSession(sessionId: string, sessionKey?: string): Promise<RealtimeSessionCredentials>;
  close(): Promise<void>;
}

export interface RunwayToolContext {
  createCharacterProfile(
    input: CreateCharacterProfileInput,
  ): Promise<OpenClawToolResult>;
  getCharacterProfile(input: GetCharacterProfileInput): Promise<OpenClawToolResult>;
  updateCharacterProfile(
    input: UpdateCharacterProfileInput,
  ): Promise<OpenClawToolResult>;
  generateCharacterImage(
    input: GenerateCharacterImageInput,
  ): Promise<OpenClawToolResult>;
  generateCharacterVideo(
    input: GenerateCharacterVideoInput,
  ): Promise<OpenClawToolResult>;
  generateStoryboardSequence(
    input: GenerateStoryboardSequenceInput,
  ): Promise<OpenClawToolResult>;
  getGenerationJob(input: GetGenerationJobInput): Promise<OpenClawToolResult>;
  waitForGenerationJob(
    input: WaitForGenerationJobInput,
  ): Promise<OpenClawToolResult>;
  listCharacterAssets(
    input: ListCharacterAssetsInput,
  ): Promise<OpenClawToolResult>;
  downloadGeneratedAsset(
    input: DownloadGeneratedAssetInput,
  ): Promise<OpenClawToolResult>;
  createLiveAvatar(input: CreateLiveAvatarInput): Promise<OpenClawToolResult>;
  getLiveAvatar(input: GetLiveAvatarInput): Promise<OpenClawToolResult>;
  createRealtimeSession(input: CreateRealtimeSessionInput): Promise<OpenClawToolResult>;
  getRealtimeSession(input: GetRealtimeSessionInput): Promise<OpenClawToolResult>;
  waitForRealtimeSession(input: WaitForRealtimeSessionInput): Promise<OpenClawToolResult>;
  consumeRealtimeSession(input: ConsumeRealtimeSessionInput): Promise<OpenClawToolResult>;
}

export interface WaitForJobOptions {
  pollIntervalMs?: number;
  timeoutMs?: number;
  maxAttempts?: number;
}
