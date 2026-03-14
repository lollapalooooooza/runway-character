# Runway Character for OpenClaw 🦞✨

A TypeScript adapter + OpenClaw plugin for building **Runway-powered character workflows**.

This project helps you turn a simple character idea into a reusable live avatar pipeline:

- 🧠 structured character profiles
- 🖼️ consistent character image generation
- 🎭 visual continuity across generations
- 🗣️ live avatar creation
- ⚡ realtime session orchestration
- 🌐 local browser demo for live calls

---

## What This Project Does 🚀

This repo connects **OpenClaw** with **Runway character workflows**.

At a high level, it lets you:

1. define a character
2. generate images of that character
3. keep the character visually consistent
4. turn the character into a live avatar
5. create a realtime session for live interaction in the browser

### Core mental model

```text
Character Profile → Character Image → Live Avatar → Realtime Session
````

---

## Who This Is For 👀

This project is useful if you want to:

* build reusable AI characters inside OpenClaw
* generate consistent visual identities for characters
* experiment with live avatars and realtime sessions
* test the full flow locally in a browser
* use the workflow through OpenClaw tools or directly in TypeScript

---

## Quick Start ⚡

### 1) Clone and install

```bash
git clone https://github.com/lollapalooooooza/runway-character.git
cd runway-character
npm install
npm run build
```

### 2) Run tests

```bash
npm test
```

### 3) Start the local live demo

```bash
node demo-live/server.mjs
```

Then open:

```text
http://localhost:4318
```

### 4) Try a tested avatar ID

You can use one of these known working avatars in the demo:

* `05adb9d7-2a4f-4456-9b75-fcc074481c85` — **Ava**
* `f61f196d-7595-4308-809e-f2feb365a30c` — **Iris**

---

## How the Workflow Works 🪄

Here is the normal end-to-end flow:

### 1. Create a character profile

Define the character’s identity and appearance.

Examples:

* name
* hairstyle
* eyes
* clothing
* style
* continuity notes

### 2. Generate character images

Use the profile to generate portraits or scenes.

The system first creates a generation job, then returns the final asset when the job finishes.

### 3. Maintain continuity

Reuse the same character profile and references so future generations stay visually consistent.

### 4. Create a live avatar

Use a generated character image as the avatar reference, then add:

* personality
* voice preset
* optional start script

### 5. Start a realtime session

Create a realtime session for the avatar, wait until it becomes ready, then consume the session credentials in a browser or frontend client.

---

## Workflow Diagram 🔁

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

---

## Ways to Use This Project 🧩

You can use this repo in three different ways:

### 1. As an OpenClaw plugin

Use the registered tools inside OpenClaw agents.

Main tool groups:

* character profile tools
* generation job tools
* asset tools
* live avatar tools
* realtime session tools

Best if you want **OpenClaw agents to drive the workflow**.

---

### 2. As a local TypeScript adapter

Import the adapter directly and call tools programmatically in Node.js / TypeScript.

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

Best if you want to **integrate the workflow into your own scripts or app**.

---

### 3. As a browser demo

A local demo is included so you can validate live-call behavior visually.

```bash
node demo-live/server.mjs
```

Then open:

```text
http://localhost:4318
```

Best if you want to **see the avatar + realtime session flow end to end**.

---

## Main Tool Categories 🧰

This project is organized around five tool groups:

### Character Profile Tools

Create, read, and update reusable character identity data.

### Character Generation Tools

Generate images, videos, and storyboard sequences.

### Asset Tools

List and download generated assets.

### Live Avatar Tools

Create and inspect live avatars.

### Realtime Session Tools

Create, poll, and consume realtime session credentials.

---

## Input / Output Reference 📚

## Character Profile Tools

| Tool                       | Main Input Parameters                                                                   | Main Output Parameters                                                 |
| -------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `create_character_profile` | `name`, `visualSummary`, `hair`, `face`, `wardrobe`, `styleTags`, `continuityNotes`     | `character.id`, `character.name`, `character.slug`, `characterSummary` |
| `get_character_profile`    | `characterId`                                                                           | `character`, `characterSummary`                                        |
| `update_character_profile` | `characterId`, profile patch fields, `addReferenceImages`, `continuityNote`, `metadata` | updated `character`, updated `characterSummary`                        |

## Character Generation Tools

| Tool                           | Main Input Parameters                                                 | Main Output Parameters                                       |
| ------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| `generate_character_image`     | `characterId`, `prompt`, `aspectRatio`, `framing`, `lighting`, `mood` | `job.id`, `providerJobId`, `status`, `character`, `assets[]` |
| `generate_character_video`     | `characterId`, `prompt`, duration / framing / motion fields           | `job.id`, `providerJobId`, `status`, `character`, `assets[]` |
| `generate_storyboard_sequence` | `characterId`, sequence prompts / shots / settings                    | multiple generation jobs, storyboard-related outputs         |
| `get_generation_job`           | `jobId`                                                               | `job`, `rawJob`, `assets[]`                                  |
| `wait_for_generation_job`      | `jobId`, `timeoutMs`, `pollIntervalMs`, `maxAttempts`                 | final `job`, `rawJob`, `assets[]`, `attempts`                |

## Asset Tools

| Tool                       | Main Input Parameters                                 | Main Output Parameters              |
| -------------------------- | ----------------------------------------------------- | ----------------------------------- |
| `list_character_assets`    | `characterId`, optional `mediaType`, optional `limit` | `assets[]`, `characterSummary`      |
| `download_generated_asset` | `assetId`, optional `outputDir`, optional `overwrite` | `filePath`, local download metadata |

## Live Avatar Tools

| Tool                 | Main Input Parameters                                                            | Main Output Parameters                                                    |
| -------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `create_live_avatar` | `name`, `referenceImage`, `personality`, `voicePresetId`, optional `startScript` | `avatar.id`, `avatar.status`, `referenceImageUri`, `processedImageUri`    |
| `get_live_avatar`    | `avatarId`                                                                       | `avatar.id`, `avatar.status`, `processedImageUri`, `voice`, `personality` |

## Realtime Session Tools

| Tool                        | Main Input Parameters                                     | Main Output Parameters                                                                  |
| --------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `create_realtime_session`   | `avatarId`                                                | `session.id`, `session.status`, `avatarId`                                              |
| `get_realtime_session`      | `sessionId`                                               | `session.id`, `session.status`, `sessionKey` when available                             |
| `wait_for_realtime_session` | `sessionId`, `timeoutMs`, `pollIntervalMs`, `maxAttempts` | final `session`, `attempts`, `READY` or terminal state                                  |
| `consume_realtime_session`  | `sessionId`                                               | `credentials.url`, `credentials.token`, `credentials.roomName`, `credentials.sessionId` |

---

## Example JSON 🧪

### `create_character_profile`

#### Input

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

#### Output

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

### `generate_character_image`

#### Input

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

#### Output

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

### `wait_for_generation_job`

#### Input

```json
{
  "jobId": "job_xxx",
  "timeoutMs": 120000,
  "pollIntervalMs": 3000,
  "maxAttempts": 50
}
```

#### Output

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

### `create_live_avatar`

#### Input

```json
{
  "name": "Ava Live",
  "referenceImage": "https://...generated-character-image.png",
  "personality": "You are Ava, calm, sharp, concise, and helpful in live conversation.",
  "voicePresetId": "clara",
  "startScript": "Hi, I am Ava. How can I help?"
}
```

#### Output

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

### `create_realtime_session`

#### Input

```json
{
  "avatarId": "avatar_xxx"
}
```

#### Output

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

### `consume_realtime_session`

#### Input

```json
{
  "sessionId": "session_xxx"
}
```

#### Output

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

## Configuration ⚙️

This project can run in two modes:

### 1. Local-only mode

Useful for:

* character profile CRUD
* local storage validation
* non-networked tests

### 2. Full Runway mode

Requires a valid Runway API key.

Example environment config:

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

In OpenClaw, config is typically read from:

```bash
~/.openclaw/openclaw.json
```

under:

```json
plugins.entries["runway-character"].config
```

---

## Tested End-to-End Flows ✅

### Ava flow

Confirmed working end to end:

* live avatar creation
* avatar readiness polling
* realtime session creation
* realtime session readiness polling
* credential consumption

Avatar ID:

* `05adb9d7-2a4f-4456-9b75-fcc074481c85`

### Iris flow

A fresh character prompt was generated and the full pipeline succeeded again.

* Character ID: `char_162bef65979844e3a27df8d336edf69e`
* Avatar ID: `f61f196d-7595-4308-809e-f2feb365a30c`

This confirms the system is **not hardcoded to a single demo avatar**.

---

## Project Structure 🗂️

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

## Summary 🎉

This repo is a complete character workflow system built on top of **OpenClaw + Runway**.

It supports:

* 🧠 structured character profiles
* 🎨 continuity-aware image generation
* 🎭 live avatar creation
* ⚡ realtime session orchestration
* 🌐 local browser demo testing

In practice, this means you can go from a simple character idea to a working live avatar pipeline inside one project.
