# Development notes

## Layout

```
index.html            the whole site, one page
style.css             all styling
theme-init.js         sets the colour theme before the page paints (kept as a file so the security policy can ban inline scripts)
js/
  main.js             starts everything
  state.js            shared state and the two cross-module hooks
  dom.js              element lookups
  ui.js               status badge, placeholder, clock, live and dark states
  control.js          modes, local network camera, flip, zoom, snapshot, fullscreen
  storage.js          localStorage wrapper and expiring saved passcodes
  live/
    quality.js        Low/Standard/High presets mapped to capture size and bitrate
    protocol.js       message format, parsing, zoom maths (no browser needed)
    backoff.js        retry delays (no browser needed)
    token.js          calls /api/token and classifies the answer
    viewer-session.js the viewer's connection logic (no browser needed)
    camera-session.js the phone's connection logic (no browser needed)
    viewer.js         wires the viewer session to the page
    camera.js         wires the camera session to the page, wake lock, battery
  features/           lens, theme, copy link, video embed, demo mission, 3D model panel
  viewer/             bob-viewer.js, the built three.js bundle (do not edit by hand)
api/
  token.js            the passcode server (Vercel serverless function)
  _lib/               channels, rate limiting, env and request helpers (the underscore keeps them from becoming URLs)
tools/
  make-channels.js    passcode generator
  check.js            wiring and consistency checks
  dev-server.js       local server with the real passcode API
tests/                unit tests, fake LiveKit, optional browser smoke test
docs/                 these guides
```

The key design choice: the connection logic lives in `viewer-session.js` and `camera-session.js`, which never touch the page. They report what is happening through events, and `viewer.js` / `camera.js` turn those events into screen updates. That is what makes reconnect behaviour testable without a browser or a LiveKit server.

## Commands

| Command | What it does |
|---|---|
| `npm install` | Installs the one dependency (`livekit-server-sdk`). |
| `npm test` | Runs all unit tests with Node's built-in runner. |
| `npm run check` | Syntax, page ids, missing files, inline-script ban, security headers, documented variables. |
| `npm run verify` | `check` then `test`. Run this before you deploy. |
| `npm run e2e` | Opens a real browser against a local server with a fake LiveKit. Needs Playwright. |
| `npm run dev` | Local server on port 3000. |

## What the tests cover

- **Passcode server:** roles and grants, case and spacing tolerance, ticket lifetime, wrong and cross-role passcodes, lockouts (per address, expiry, not reset by success), request flood limit, cross-site refusal, every configuration error, the old two-passcode mode, shared store failure fallback.
- **Viewer connection:** join, waiting for camera, camera leaving and returning, dropped connections, growing and capped retry delays, reset after a stable connection, expired ticket then fresh ticket, wrong passcode, rate limit waits, offline start, stopping mid-join, ignoring events from replaced rooms, commands addressed to the camera, untrusted messages, six simultaneous viewers, viewers coming and going, channel isolation.
- **Camera connection:** publish and capabilities, switching front and back, failed switch, zoom range and limits, phones without zoom, every permission and hardware error, retries, wrong passcode, rate limit waits, drops and reconnects, network blips, a second phone taking over, stopping mid-join, ignoring strangers, expired ticket on rejoin.
- **Browser smoke test:** page loads with no script errors or security-policy violations, theme, demo, wrong passcode, remembered passcode, lockout message, camera streaming and auto restart, no sideways scroll on a phone.

The tests use a fake LiveKit that models rooms, identities, data messages, publishing and the "same identity joins twice" kick. It is a model, not the real service, so section 12 of the deployment guide still lists what to check on real devices.

## Adding a feature checklist

1. Put logic that does not need the page into a session or helper module and test it.
2. Keep scripts external and styles in `style.css`, because the security policy blocks inline code.
3. Run `npm run verify`.
4. If you add an environment variable, mention it in `docs/DEPLOYMENT.md` (the check fails otherwise).

## The 3D model of Bob

The model is generated from code, so changing a size is a one-line edit.

- `cad/bob_v2.py` builds Bob with [build123d](https://github.com/gumyr/build123d) (`pip install build123d`). Run `python3 cad/bob_v2.py` for the STEP and STL files (open hangar doors, for Onshape or a slicer) and `python3 cad/bob_v2.py --web` for `models/bob-v2.glb`, the closed-door model the website loads.
- `tools/viewer-src/viewer.js` is the three.js scene. After editing it run `npm run build:viewer`, which writes `js/viewer/bob-viewer.js`. The site loads that file only when the "Inside Bob" section is near the screen, so visitors who never scroll there download nothing.
- `js/features/model-data.js` lists which parts belong to which button, the text each button shows and the colour schemes. It has no browser code, so `tests/model-data.test.js` can check it against the real model file. Part names come from the model, so rename a part in `bob_v2.py` and the test tells you what to update.
- `tools/make-poster.mjs` renders `models/bob-v2-poster.png`. Convert it to `models/bob-v2-poster.webp` (the picture shown while the model loads and when WebGL is missing).
- three.js is bundled into the site, not loaded from a CDN, so the Content-Security-Policy stays strict. The smoke test loads the model under the real headers.
