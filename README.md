# BOB: the rescue robot control room

Bob is a rescue robot. A phone mounted on the robot is its eyes. This website is the control room: it shows the phone's live camera on a PC, over HTTPS, from anywhere.

- **One page.** The live picture sits inside the control room, next to the controls.
- **Browser to browser.** No app needed. The phone opens the website in Chrome and becomes the camera. Video travels through LiveKit Cloud.
- **Many robots.** Each robot has its own private channel with its own passcodes, so owners in different places only ever see their own feed.
- **Controls.** Switch between front and back camera, zoom (optical when the phone supports it), video quality (Low 360p, Standard 720p, High 1080p; chosen on the camera phone or remotely from the viewer), snapshot, fullscreen.
- **Survives trouble.** If the network drops, the phone and the PC reconnect by themselves with a fresh ticket. If a second phone takes over as the camera, the first one steps aside.
- **Fallbacks.** A demo mission for practice, and a Local network mode for the IP Webcam app when you run the site over plain `http` on your own network.

## Quick start

1. Follow the [deployment guide](docs/DEPLOYMENT.md). It covers LiveKit, GitHub, Vercel, your domain and the passcodes, step by step.
2. Generate one channel per robot:

   ```
   node tools/make-channels.js "bob1" "bob2" "bob3"
   ```

3. Paste the printed line into the `BOB_CHANNELS` variable in Vercel and redeploy.
4. On the phone open `https://bob.jrofficial.org/#camera`, enter the robot's phone passcode, press **Start camera**.
5. On the PC open `https://bob.jrofficial.org`, enter the robot's PC passcode in the control room, press **Connect**.

## How it fits together

```
phone on Bob ──┐                                   ┌── PC in control room
 (camera)      │   ticket from /api/token          │    (viewer)
               ├── LiveKit Cloud (one room per robot) ──┤
 passcode ─────┘                                   └── passcode
```

- `/api/token` checks a passcode and hands back a short-lived ticket for exactly one robot's room.
- LiveKit relays the video and the small control messages (switch camera, zoom, quality).
- Nothing about a robot is stored on a server except the list in `BOB_CHANNELS`.

## Documentation

| Guide | For |
|---|---|
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Setting everything up, adding robots, troubleshooting, and a checklist to run on real devices before a competition. |
| [docs/SECURITY.md](docs/SECURITY.md) | How access works, what was hardened, and the risks that remain. |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Code layout, commands, what the tests cover. |

## Commands

```
npm install        install the one dependency
npm run verify     checks + all tests (run before deploying)
npm run e2e        browser smoke test (needs Playwright)
npm run dev        local server at http://localhost:3000
npm run channels   same as node tools/make-channels.js
```

## Limits worth knowing

- The free LiveKit plan has a monthly allowance of participant-minutes shared by every robot and every viewer. More robots and more viewers use it faster.
- The phone must keep the Bob tab open and in front with the screen on. It does not need to be plugged in, but long runs use battery.
- Anyone who knows a channel's passcode can watch it. Rotate passcodes after events. Details are in the security notes.
