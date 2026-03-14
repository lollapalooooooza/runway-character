# Runway Character for OpenClaw

OpenClaw plugin + TypeScript adapter for building **Runway-powered character workflows**:

- structured character profiles
- image generation and continuity
- live avatar creation
- realtime session orchestration
- local browser demo for live calls

---

## Quick start

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

---

## What this project does

This project is not a generic chat provider.
It is a **character workflow layer** for OpenClaw and local development.

It gives you a reusable system for:

1. creating structured character profiles
2. generating character images
3. maintaining character continuity across generations
4. converting generated characters into live avatars
5. creating realtime sessions for live video calls
6. testing all of the above through both tools and a local demo page

---

## Current status

This repo has moved well beyond a skeleton.

### Confirmed working

#### Character system
- create character profiles
- read/update character profiles
- generate character images
- wait for async generation jobs
- store and list generated assets
- download generated assets
- reference-based second-pass image generation
- safer fallback strategy for continuity flows

#### Live avatar system
- create live avatars from generated character images
- poll live avatars until `READY`
- create realtime sessions
- poll realtime sessions until `READY`
- consume realtime session credentials
- return LiveKit/WebRTC connection info

#### Local demo
- local Node server
- browser-based live demo page
- local camera preview
- remote avatar video surface
- server-side session credential flow

---

## How to use

You can use this project in **three ways**:

### 1. As an OpenClaw plugin
The plugin registers tools that OpenClaw agents can call directly.

### 2. As a local TypeScript adapter
You can import the adapter in Node/TypeScript and call tools programmatically.

### 3. As a local demo
You can run the included browser demo to validate realtime avatar calls visually.

---

## Primary workflows

## A. Character image workflow

### Input
Typical input for a character image flow:

- character name
- visual summary
- optional hair / face / wardrobe anchors
- optional continuity notes
- prompt
- framing
- lighting
- mood
- aspect ratio

### Example input

```json
{
  "name": "Iris Vale",
  "visualSummary": "dark auburn bob, pale green eyes, structured cream blazer",
  "hair": "dark auburn bob",
  "face": "pale green eyes",
  "wardrobe": ["structured cream blazer"]
}
```

Then image generation:

```json
{
  "characterId": "char_xxx",
  "prompt": "Editorial portrait of Iris Vale, dark auburn bob, pale green eyes, structured cream blazer, calm intelligent expression, soft studio light",
  "aspectRatio": "16:9",
  "framing": "medium close-up",
  "lighting": "soft studio light",
  "mood": "calm"
}
```

### Output
Character image flow produces:

- character profile id
- generation job id
- provider task id
- generated asset id
- downloadable asset URL

### Example output shape

```json
{
  "job": {
    "id": "job_xxx",
    "status": "succeeded"
  },
  "assets": [
    {
      "id": "asset_xxx",
      "outputUrl": "https://..."
    }
  ]
}
```

---

## B. Character continuity workflow

### Input
A continuity workflow uses:

- an existing character profile
- one or more reference images
- a second-pass generation prompt

### Output
This produces:

- a second generation job
- continuity-preserved asset(s)
- fallback strategy behavior if the first reference-based attempt fails

### Notes
This project includes safer fallback logic for reference-based generation, because aggressive prompts can make upstream generation unstable.

---

## C. Live avatar workflow

### Input
A live avatar workflow uses:

- avatar name
- reference image URL
- personality description
- voice preset id
- optional starting script

### Example input

```json
{
  "name": "Iris Vale Live",
  "referenceImage": "https://...generated-character-image.png",
  "personality": "You are Iris Vale, calm, articulate, thoughtful, and concise in live conversation.",
  "voicePresetId": "nina",
  "startScript": "Hello, I am Iris. What would you like to explore today?"
}
```

### Output
Live avatar creation produces:

- avatar id
- avatar processing status
- processed avatar preview image when ready

### Example output shape

```json
{
  "avatar": {
    "id": "avatar_xxx",
    "status": "READY",
    "processedImageUri": "https://..."
  }
}
```

---

## D. Realtime live-call workflow

### Input
Realtime session creation uses:

- avatar id

### Example input

```json
{
  "avatarId": "avatar_xxx"
}
```

### Output
Realtime session flow produces:

- realtime session id
- session status
- session key when ready
- consumed credentials for browser connection

### Example final output shape

```json
{
  "url": "wss://...",
  "token": "...",
  "roomName": "...",
  "sessionId": "session_xxx"
}
```

This output is what the browser demo uses to connect to LiveKit/WebRTC.

---

## Main tools registered

The plugin registers these OpenClaw tools:

### Character generation tools
- `create_character_profile`
- `get_character_profile`
- `update_character_profile`
- `generate_character_image`
- `generate_character_video`
- `generate_storyboard_sequence`
- `get_generation_job`
- `wait_for_generation_job`
- `list_character_assets`
- `download_generated_asset`

### Live avatar / realtime tools
- `create_live_avatar`
- `get_live_avatar`
- `create_realtime_session`
- `get_realtime_session`
- `wait_for_realtime_session`
- `consume_realtime_session`

---

## Example usage in code

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

---

## Project structure

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

## Tested results

## Ava live flow
Confirmed working end to end:

- live avatar creation
- avatar readiness polling
- realtime session creation
- realtime session readiness polling
- credential consumption

### Ava avatar
- Avatar ID: `05adb9d7-2a4f-4456-9b75-fcc074481c85`

---

## Iris flow (fresh prompt retest)
A completely new character prompt was generated and the full pipeline succeeded again.

### Character prompt
- Name: `Iris Vale Live Test`
- Visual summary: `dark auburn bob, pale green eyes, structured cream blazer`
- Image prompt:

```text
Editorial portrait of Iris Vale, dark auburn bob, pale green eyes, structured cream blazer, calm intelligent expression, soft studio light
```

### Result
- Character ID: `char_162bef65979844e3a27df8d336edf69e`
- Generated image job succeeded
- Live avatar was created and reached `READY`
- Realtime session was created and reached `READY`
- Session credentials were consumed successfully

### Iris live avatar
- Avatar ID: `f61f196d-7595-4308-809e-f2feb365a30c`

This confirms the system is not hardcoded to a single demo avatar.

---

## Live demo
A minimal browser demo is included here:

```bash
demo-live/
```

Start it with:

```bash
node demo-live/server.mjs
```

Open:

```text
http://localhost:4318
```

See the full demo-specific guide here:

```bash
demo-live/README.md
```

---

## GitHub publishing notes
This repo intentionally excludes unrelated or sensitive local directories, including:

- `echo2-debug/`
- `jiayangwen/`
- local `.env` files
- packaged tarballs
- generated JSON data payloads

This keeps the published repository focused on the Runway Character project itself.

---

## Recommended next steps

If you want to keep pushing this further, the highest-value next steps are:

1. dynamic avatar-name lookup in the demo UI
2. avatar selector dropdown
3. more polished frontend built on the official avatars React SDK
4. browser automation tests for the demo
5. deployable hosted version of the live demo
6. stronger docs around prompt strategy and continuity

---

## Summary

This repo now demonstrates a complete character stack:

- static character generation
- continuity-aware image workflows
- live avatar creation
- realtime session orchestration
- browser demo integration

In other words: this is no longer just a plugin skeleton — it is a working character workflow system.
