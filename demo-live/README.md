# Ava Live Call Demo

A minimal local demo for testing **Runway Character** live avatar calls from this project.

This demo sits on top of the `runway-character` adapter and proves an end-to-end flow:

1. Generate a character image
2. Turn that image into a Runway live avatar
3. Create a realtime session
4. Wait for the session to become `READY`
5. Consume connection credentials
6. Join the room from a browser and view the avatar video

---

## What this demo is for

This demo is intentionally small.

It is **not** a production UI.
It is a **verification surface** for:

- character image generation
- character-to-live-avatar conversion
- realtime session orchestration
- LiveKit/WebRTC credential handoff
- browser-side local/remote media connection

If you want a fast answer to “does the core character system actually work?”, this is the page.

---

## Project location

```bash
/Users/bryanwen/Documents/New project/demo-live
```

Main files:

- `server.mjs` — tiny local Node server
- `public/index.html` — static front-end demo page

---

## Features currently covered

### UI
- clean minimal landing page
- editable Avatar ID field
- dynamic button label like `Connect to Ava` / `Connect to Iris`
- remote avatar video panel
- local camera preview panel
- status log panel
- resource links for SDK and Runway docs

### Backend
- loads Runway config from `~/.openclaw/openclaw.json`
- uses the local `runway-character` adapter from this repo
- creates realtime sessions server-side
- waits until session is ready
- consumes credentials securely on the server
- returns room credentials to the browser

### Frontend
- connects to LiveKit with returned credentials
- publishes local camera + microphone
- renders remote avatar video
- renders local camera preview

---

## Requirements

You need:

- Node.js
- this project built successfully
- a valid Runway API key configured through OpenClaw plugin config
- browser camera/microphone permissions

This demo reads config from:

```bash
~/.openclaw/openclaw.json
```

Specifically from:

```json
plugins.entries["runway-character"].config
```

Expected fields include:

- `apiKey`
- `baseUrl`
- `timeoutMs`
- `maxRetries`
- `pollIntervalMs`
- `defaultAspectRatio`
- `debug`

---

## Start the demo

From the repo root:

```bash
cd "/Users/bryanwen/Documents/New project"
node demo-live/server.mjs
```

If successful, you should see:

```bash
Runway live demo server listening on http://localhost:4318
```

Open the demo in your browser:

```text
http://localhost:4318
```

---

## How the demo works

### Browser side
The browser page does this:

1. reads the Avatar ID from the input field
2. calls:

```http
POST /api/avatar/live-session
```

3. receives:
   - `url`
   - `token`
   - `roomName`
   - `sessionId`
4. connects to LiveKit in the browser
5. publishes local audio/video
6. renders remote avatar video and local preview

### Server side
The local server does this:

1. receives `avatarId`
2. calls adapter tool:
   - `create_realtime_session`
3. waits using:
   - `wait_for_realtime_session`
4. consumes credentials using:
   - `consume_realtime_session`
5. returns room credentials to the browser

This design keeps the Runway secret on the server side.

---

## Available routes

### `GET /`
Serves the demo page.

### `GET /api/health`
Returns a simple health response.

Example:

```bash
curl http://localhost:4318/api/health
```

### `POST /api/avatar/live-session`
Creates and prepares a realtime session for an existing avatar.

Request:

```json
{
  "avatarId": "05adb9d7-2a4f-4456-9b75-fcc074481c85"
}
```

Response:

```json
{
  "url": "wss://...",
  "token": "...",
  "roomName": "...",
  "sessionId": "..."
}
```

### `POST /api/avatar/create`
Creates a new live avatar directly through the adapter.

---

## Demo avatars tested

### Ava
- Avatar ID: `05adb9d7-2a4f-4456-9b75-fcc074481c85`
- Button label: `Connect to Ava`

### Iris
- Avatar ID: `f61f196d-7595-4308-809e-f2feb365a30c`
- Button label: `Connect to Iris`

These two are currently mapped in the frontend for short display names.

---

## Full tested flows

## 1. Ava live flow
Confirmed working:

- live avatar creation
- avatar readiness polling
- realtime session creation
- realtime session readiness polling
- session credential consumption
- browser demo page integration

### Ava live avatar
- Avatar ID: `05adb9d7-2a4f-4456-9b75-fcc074481c85`

### Ava session example
- Session ID: `94e2f172-be20-48d4-b75e-0ba7aa6af128`

---

## 2. Iris end-to-end regenerated flow
A brand new character prompt was used and the full chain succeeded.

### Character prompt
- Name: `Iris Vale Live Test`
- Visual summary: `dark auburn bob, pale green eyes, structured cream blazer`
- Image prompt:

```text
Editorial portrait of Iris Vale, dark auburn bob, pale green eyes, structured cream blazer, calm intelligent expression, soft studio light
```

### Character creation
- Character ID: `char_162bef65979844e3a27df8d336edf69e`

### Generated image job
- Job ID: `job_508f15e03962450aa821ac2005bba621`
- Provider task ID: `c5c564f2-1d3c-4227-a76b-27714773a5dd`
- Asset ID: `asset_30a6a7ce8d4f436caef045b9b9c84d66`

### Live avatar
- Avatar ID: `f61f196d-7595-4308-809e-f2feb365a30c`
- Display name: `Iris Vale Live Smoke`
- Voice preset: `nina`

### Realtime session
- Session ID: `cd950780-868b-4042-b3f4-75b61fdd0ad7`

### Final result
- avatar became `READY`
- realtime session became `READY`
- credentials were successfully consumed
- LiveKit URL + token were returned successfully

This confirms the system works for more than one character and is not hardcoded to Ava.

---

## Character system status summary

The project has now been tested across two layers:

### Static / continuity character system
Confirmed working:

- create character profile
- update profile
- generate character image
- add references
- second-pass consistency generation
- fallback strategy for safer reference-based prompts
- asset persistence and download

### Live character backend system
Confirmed working:

- create live avatar
- poll avatar until ready
- create realtime session
- poll session until ready
- consume session credentials

### Browser demo
Confirmed working at the integration level:

- local page loads
- server route creates session credentials
- browser can use returned credentials to connect to the room

---

## UI notes

The current UI intentionally uses:

- a minimal white Notion-style layout
- short display names like `Ava` and `Iris`
- fixed 16:9 remote and local panes
- softer borders and low-noise styling

Recent adjustments included:

- removing the subtitle paragraph
- improving panel alignment
- changing button copy to short names
- tuning remote video framing to better preserve the avatar’s head and face
- adjusting width balance between remote and local panes

---

## Troubleshooting

## Page opens but no connection happens
Check the server is running:

```bash
cd "/Users/bryanwen/Documents/New project"
node demo-live/server.mjs
```

Then verify health:

```bash
curl http://localhost:4318/api/health
```

---

## `ENOENT` error with `%20` in path
This was caused by using `import.meta.url` pathname directly with a space-containing directory name like:

```bash
/Users/bryanwen/Documents/New project
```

It was fixed by switching to:

```js
fileURLToPath(import.meta.url)
```

---

## Session creation works but consume fails
This previously happened because the consume request was missing:

```http
Content-Type: application/json
```

It has been fixed by sending a JSON body and proper headers.

---

## Browser page looks unchanged after edits
Hard refresh the page:

- macOS: `Cmd + Shift + R`

---

## No local camera preview
Check:

- browser camera permission
- browser microphone permission
- the device actually has a usable camera

---

## Remote avatar video is cropped awkwardly
The demo uses CSS to control framing. You can adjust:

```css
#remotePane video {
  object-fit: cover;
  object-position: 62% center;
}
```

Change `62%` to shift the visible portion horizontally.

---

## Useful resources

### Runway Avatars React SDK
https://github.com/runwayml/avatars-sdk-react

### Runway Character Integration Docs
https://docs.dev.runwayml.com/characters/integration/

### Runway API Reference
https://docs.dev.runwayml.com/api/

---

## Suggested next steps

If you want to take this from demo to product, the next sensible improvements are:

1. fetch avatar names dynamically from the backend instead of frontend mapping
2. add an avatar selector dropdown
3. add session history / recent avatars
4. add a proper frontend framework version using Runway’s avatars React SDK
5. add deployable environment support
6. add end-to-end browser automation tests
7. support creating a live avatar directly from the UI

---

## Quick start recap

```bash
cd "/Users/bryanwen/Documents/New project"
node demo-live/server.mjs
```

Open:

```text
http://localhost:4318
```

Use one of these Avatar IDs:

### Ava
```text
05adb9d7-2a4f-4456-9b75-fcc074481c85
```

### Iris
```text
f61f196d-7595-4308-809e-f2feb365a30c
```

Then click:

- `Connect to Ava`
- or `Connect to Iris`

That is the shortest path to verifying the current character live-call system.
