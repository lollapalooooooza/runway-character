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

### Using Runway Character through OpenClaw

The simplest way to think about this project is:

- you give OpenClaw a character idea
- OpenClaw creates a reusable character profile
- OpenClaw can generate images of that character
- OpenClaw can keep the character visually consistent across multiple generations
- OpenClaw can turn the character into a live avatar
- OpenClaw can create a realtime session for a live video call

In plain language, the workflow usually looks like this:

1. **Create a character**
   - Give the character a name and visual identity
   - Example: hair, eyes, clothing, style, mood

2. **Generate the character image**
   - Ask for a portrait or scene of that character
   - The system returns a generation job, then the final asset

3. **Refine continuity**
   - Reuse the same character profile and references
   - Generate more images while preserving identity

4. **Create a live avatar**
   - Use one of the generated character images as the avatar reference
   - Add a personality and voice preset

5. **Start a live session**
   - Create a realtime session for that avatar
   - Wait until it is ready
   - Consume credentials and connect a frontend client

So if you are using this through OpenClaw, the mental model is very simple:

> **Character profile → generated image → live avatar → realtime session**

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

## JSON Examples

### 1. `create_character_profile`

#### Example input

```json
{
  "name": "Ava Sterling",
  "visualSummary": "short black hair, amber eyes, tailored coat",
  "hair": "short black hair",
  "face": "amber eyes",
  "wardrobe": ["tailored coat"],
  "styleTags": ["cinematic", "clean portrait"],
  "continuityNotes": [
    "Keep the amber eyes and tailored coat consistent."
  ]
}
```

#### Example output

```json
{
  "ok": true,
  "toolName": "create_character_profile",
  "data": {
    "character": {
      "id": "char_xxx",
      "name": "Ava Sterling",
      "slug": "ava-sterling",
      "visualSummary": "short black hair, amber eyes, tailored coat"
    },
    "characterSummary": {
      "id": "char_xxx",
      "name": "Ava Sterling",
      "referenceImageCount": 0
    }
  }
}
```

### 2. `generate_character_image`

#### Example input

```json
{
  "characterId": "char_xxx",
  "prompt": "Ava Sterling portrait, short black hair, amber eyes, tailored coat, cinematic realistic character portrait",
  "aspectRatio": "16:9",
  "framing": "medium close-up",
  "lighting": "soft cinematic lighting",
  "mood": "composed"
}
```

#### Example output

```json
{
  "ok": true,
  "toolName": "generate_character_image",
  "data": {
    "job": {
      "id": "job_xxx",
      "providerJobId": "provider_task_xxx",
      "status": "queued"
    },
    "assets": []
  }
}
```

### 3. `wait_for_generation_job`

#### Example input

```json
{
  "jobId": "job_xxx",
  "timeoutMs": 120000,
  "pollIntervalMs": 3000,
  "maxAttempts": 50
}
```

#### Example output

```json
{
  "ok": true,
  "toolName": "wait_for_generation_job",
  "data": {
    "job": {
      "id": "job_xxx",
      "status": "succeeded"
    },
    "assets": [
      {
        "id": "asset_xxx",
        "outputUrl": "https://..."
      }
    ],
    "attempts": 4
  }
}
```

### 4. `create_live_avatar`

#### Example input

```json
{
  "name": "Ava Live",
  "referenceImage": "https://...generated-character-image.png",
  "personality": "You are Ava, calm, sharp, concise, and helpful in live conversation.",
  "voicePresetId": "clara",
  "startScript": "Hi, I am Ava. How can I help?"
}
```

#### Example output

```json
{
  "ok": true,
  "toolName": "create_live_avatar",
  "data": {
    "avatar": {
      "id": "avatar_xxx",
      "name": "Ava Live",
      "status": "PROCESSING",
      "referenceImageUri": "https://..."
    }
  }
}
```

### 5. `create_realtime_session`

#### Example input

```json
{
  "avatarId": "avatar_xxx"
}
```

#### Example output

```json
{
  "ok": true,
  "toolName": "create_realtime_session",
  "data": {
    "session": {
      "id": "session_xxx",
      "avatarId": "avatar_xxx"
    }
  }
}
```

### 6. `consume_realtime_session`

#### Example input

```json
{
  "sessionId": "session_xxx"
}
```

#### Example output

```json
{
  "ok": true,
  "toolName": "consume_realtime_session",
  "data": {
    "credentials": {
      "url": "wss://...",
      "token": "...",
      "roomName": "session_xxx",
      "sessionId": "session_xxx"
    }
  }
}
```

---

## Workflow Diagram

```text
Character Idea
   ↓
Create Character Profile
   ↓
Generate Character Image
   ↓
(Optional) Add References + Continuity
   ↓
Create Live Avatar
   ↓
Wait for Avatar READY
   ↓
Create Realtime Session
   ↓
Wait for Session READY
   ↓
Consume Session Credentials
   ↓
Connect Browser Client / Live Call
```

This is the core mental model for the project.

- the character profile defines identity
- generated images provide the visual base
- the live avatar turns that base into a realtime speaking character
- the realtime session provides credentials for the browser or client app

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
