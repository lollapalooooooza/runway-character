# Runway Character for OpenClaw

OpenClaw plugin + TypeScript adapter for building **Runway-powered character workflows**:

- structured character profiles
- image generation and continuity
- live avatar creation
- realtime session orchestration
- local browser demo for live calls

---

## Quick Start

Clone the repository and install dependencies:

```bash
git clone https://github.com/lollapalooooooza/runway-character.git
cd runway-character
npm install
npm run build
```

Run tests:

```bash
npm test
```

Start the local live demo:

```bash
node demo-live/server.mjs
```

Open in your browser:

```text
http://localhost:4318
```

Use one of the tested avatar IDs:

- `05adb9d7-2a4f-4456-9b75-fcc074481c85` → Ava
- `f61f196d-7595-4308-809e-f2feb365a30c` → Iris

---

## How to Use

This project can be used in **three main ways**.

### 1. As an OpenClaw plugin
Use the registered tools inside OpenClaw agents.

Main tool groups:

- character profile tools
- generation job tools
- asset tools
- live avatar tools
- realtime session tools

### 2. As a local TypeScript adapter
Import the adapter directly in Node/TypeScript and call tools programmatically.

Example:

```ts
import { createRunwayCharacterAdapter } from "./dist/src/adapter.js";

const adapter = createRunwayCharacterAdapter({
  apiKey: process.env.RUNWAY_API_KEY,
  baseUrl: process.env.RUNWAY_BASE_URL,
});

const result = await adapter.executeTool("create_character_profile", {
  name: "Ava Sterling",
  visualSummary: "short black hair, amber eyes, tailored coat",
  wardrobe: ["tailored coat"],
});

console.log(result);
```

### 3. As a browser demo
Run the included local demo to validate live-call behavior visually.

```bash
node demo-live/server.mjs
```

Then open:

```text
http://localhost:4318
```

---

## Input / Output Reference

### Character Profile Tools

| Tool | Main Input Parameters | Main Output Parameters |
|---|---|---|
| `create_character_profile` | `name`, `visualSummary`, `hair`, `face`, `wardrobe`, `styleTags`, `continuityNotes` | `character.id`, `character.name`, `character.slug`, `characterSummary` |
| `get_character_profile` | `characterId` | `character`, `characterSummary` |
| `update_character_profile` | `characterId`, profile patch fields, `addReferenceImages`, `continuityNote`, `metadata` | updated `character`, updated `characterSummary` |

### Character Generation Tools

| Tool | Main Input Parameters | Main Output Parameters |
|---|---|---|
| `generate_character_image` | `characterId`, `prompt`, `aspectRatio`, `framing`, `lighting`, `mood` | `job.id`, `providerJobId`, `status`, `character`, `assets[]` |
| `generate_character_video` | `characterId`, `prompt`, duration / framing / motion-related fields | `job.id`, `providerJobId`, `status`, `character`, `assets[]` |
| `generate_storyboard_sequence` | `characterId`, sequence prompts / shots / settings | multiple generation jobs, storyboard-related outputs |
| `get_generation_job` | `jobId` | `job`, `rawJob`, `assets[]` |
| `wait_for_generation_job` | `jobId`, `timeoutMs`, `pollIntervalMs`, `maxAttempts` | final `job`, `rawJob`, `assets[]`, `attempts` |

### Asset Tools

| Tool | Main Input Parameters | Main Output Parameters |
|---|---|---|
| `list_character_assets` | `characterId`, optional `mediaType`, optional `limit` | `assets[]`, `characterSummary` |
| `download_generated_asset` | `assetId`, optional `outputDir`, optional `overwrite` | `filePath`, local download metadata |

### Live Avatar Tools

| Tool | Main Input Parameters | Main Output Parameters |
|---|---|---|
| `create_live_avatar` | `name`, `referenceImage`, `personality`, `voicePresetId`, optional `startScript` | `avatar.id`, `avatar.status`, `referenceImageUri`, `processedImageUri` |
| `get_live_avatar` | `avatarId` | `avatar.id`, `avatar.status`, `processedImageUri`, `voice`, `personality` |

### Realtime Session Tools

| Tool | Main Input Parameters | Main Output Parameters |
|---|---|---|
| `create_realtime_session` | `avatarId` | `session.id`, `session.status`, `avatarId` |
| `get_realtime_session` | `sessionId` | `session.id`, `session.status`, `sessionKey` when available |
| `wait_for_realtime_session` | `sessionId`, `timeoutMs`, `pollIntervalMs`, `maxAttempts` | final `session`, `attempts`, READY / terminal state |
| `consume_realtime_session` | `sessionId` | `credentials.url`, `credentials.token`, `credentials.roomName`, `credentials.sessionId` |

---

## Configuration

This project can run in two modes:

### Local-only profile/storage mode
Useful for:
- profile CRUD
- local storage validation
- non-networked tests

### Full Runway mode
Requires a valid Runway API key.

Environment example:

```bash
RUNWAY_API_KEY=your-runway-api-key
RUNWAY_BASE_URL=https://api.dev.runwayml.com/v1
RUNWAY_TIMEOUT_MS=30000
RUNWAY_MAX_RETRIES=3
RUNWAY_POLL_INTERVAL_MS=2000
RUNWAY_DEFAULT_ASPECT_RATIO=16:9
RUNWAY_DEFAULT_OUTPUT_DIR=./data/generated
RUNWAY_DEBUG=false
RUNWAY_USE_LOCAL_STORE=true
```

In OpenClaw usage, config is typically read from:

```bash
~/.openclaw/openclaw.json
```

under:

```json
plugins.entries["runway-character"].config
```

---

## Tested Results

### Ava live flow
Confirmed working end to end:

- live avatar creation
- avatar readiness polling
- realtime session creation
- realtime session readiness polling
- credential consumption

Ava avatar:

- Avatar ID: `05adb9d7-2a4f-4456-9b75-fcc074481c85`

### Iris flow (fresh prompt retest)
A completely new character prompt was generated and the full pipeline succeeded again.

- Character ID: `char_162bef65979844e3a27df8d336edf69e`
- Iris live avatar ID: `f61f196d-7595-4308-809e-f2feb365a30c`

This confirms the system is not hardcoded to a single demo avatar.

---

## Project Structure

```text
.
├── openclaw.plugin.json
├── package.json
├── README.md
├── .env.example
├── demo-live/
│   ├── README.md
│   ├── server.mjs
│   └── public/
│       └── index.html
├── src/
│   ├── adapter.ts
│   ├── plugin.ts
│   ├── register.ts
│   ├── config.ts
│   ├── errors.ts
│   ├── index.ts
│   ├── characterConsistencySmoke.ts
│   ├── client/
│   │   └── runwayClient.ts
│   ├── mappers/
│   ├── runtime/
│   ├── storage/
│   ├── tools/
│   └── utils/
├── test/
├── data/
└── tsconfig.json
```

---

## Summary

This repo now demonstrates a complete character stack:

- static character generation
- continuity-aware image workflows
- live avatar creation
- realtime session orchestration
- browser demo integration

In other words: this is no longer just a plugin skeleton — it is a working character workflow system.
