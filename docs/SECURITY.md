# Security notes

This is a review of how passcodes, sessions and access work in Bob, what was changed because of it, and what risks remain. It is written for the people who run Bob, not only for developers.

## What is being protected

- **Who can watch a robot's camera.** Anyone with a channel's viewer passcode.
- **Who can act as the robot's camera.** Anyone with its camera passcode. A second phone with that passcode replaces the first one.
- **The LiveKit account.** The API key and secret can create tickets for any room and use up your allowance. They live only in Vercel's environment variables and are never sent to a browser.

## How access works

1. A device sends its passcode to `/api/token`.
2. The server compares it, in constant time, against every channel's passcode for that role. Case, spaces and dashes are ignored.
3. On a match it returns a **ticket** (a signed LiveKit token) that is valid for one room, one identity and a short time. The ticket also says whether the device may publish video.
4. The device joins LiveKit with the ticket. LiveKit never sees passcodes.

There are no cookies and no login sessions. The only long-lived secret is the passcode itself.

## Review findings and what changed

| # | Finding | Risk | Change |
|---|---|---|---|
| 1 | The passcode endpoint could be guessed at without limit. | Brute force. | Per-address limits: 8 wrong passcodes per 15 minutes, then a lockout (HTTP 429 with `Retry-After`), and 60 requests per minute. Successful logins do not reset the failure count, so an attacker cannot reset the counter with their own valid passcode. Clients back off and honour `Retry-After`. |
| 2 | In-memory counters are per server instance and reset on restart. | Limit is best effort. | Optional shared Redis store (Upstash) makes it exact. If the store fails the server uses memory, so an outage never locks everyone out. Setup is in the deployment guide. |
| 3 | Passcodes were short, human-chosen words. | Guessable. | The generator now makes three random words plus four digits (about 34 bits) and refuses to generate duplicates. The server rejects channel passcodes shorter than 8 characters. |
| 4 | "Remember" saved the passcode in `localStorage` forever, in plain text. | Anyone using the browser later, or any injected script, could read it. | It is still opt-in and off by default, but now expires (14 days for a control room PC, 90 days for a robot's phone) and the clock refreshes each time the device successfully connects, so devices in use stay signed in. It is erased on a wrong passcode and the moment the box is unticked. Older plain saves are upgraded automatically. |
| 5 | Tickets lasted 6 hours. | A leaked ticket would work for hours. | Default is now 30 minutes (`BOB_TOKEN_TTL` to change). A ticket is only needed to join. Devices fetch a fresh one every time they reconnect, and the tests cover that path. |
| 6 | No browser-side defence against injected scripts. | An injected script could steal a remembered passcode. | A strict Content-Security-Policy: scripts only from this site, no inline scripts, connections only to this site and `*.livekit.cloud`. Inline code was removed from the page to make this possible. Also `X-Frame-Options: DENY`, HSTS and `nosniff`. |
| 7 | Other websites could call the passcode endpoint from a visitor's browser. | Token farming and noisy guessing from third-party pages. | Requests from a different origin are refused with 403 unless listed in `ALLOWED_ORIGINS`. This is a convenience, not an authentication step, because non-browser tools can still call the endpoint. The rate limits cover that. |
| 8 | Wrong-passcode responses were instant. | Faster guessing. | A short delay is added to wrong answers. |
| 9 | Misconfiguration could hide behind a vague error. | Wasted time, or running with weak settings. | The server explains what is missing or wrong, and refuses duplicate, malformed or too-short passcodes. |

## What the viewers and cameras can and cannot do

- A **viewer** ticket cannot publish video. Viewers can send small command messages (switch camera, zoom) to the camera in their own channel. They cannot reach other channels because every channel is a separate LiveKit room.
- A **camera** ticket can publish and receive. Two cameras cannot share a channel. The newer one wins.
- Channel separation is tested: a viewer in one channel never receives video or commands from another.

## Risks that remain

- **A passcode is shared by everyone who knows it.** There are no personal accounts, no audit log of who watched, and no way to revoke one person without changing the passcode and redeploying.
- **Anyone who watches can control zoom and camera switching.** If you need view-only guests (for example judges), a separate view-only passcode would be a small follow-up.
- **A leaked camera passcode lets someone replace the robot's feed.** Keep camera passcodes more private than viewer passcodes.
- **Media is encrypted in transit but not end to end.** LiveKit's servers handle the video.
- **A remembered passcode can be read by anyone with access to that browser's developer tools.** Only tick Remember on devices that belong to you, never on shared computers. The alternative, storing nothing, would stop the mounted phone from restarting itself, which matters more for this use. A future option is a per-device credential issued by the server.
- **Distributed guessing.** The limit is per address. An attacker with thousands of addresses can still try many guesses overall. With about 34 bits of randomness and 8 tries per 15 minutes per address, that would take far longer than a competition, but it is a reason to keep passcodes long, rotate them after events, and consider adding Vercel's firewall rate limiting if your plan offers it.
- **The browser policy only allows LiveKit Cloud.** A self-hosted LiveKit domain must be added to `connect-src` in `vercel.json`.
- **Passcodes you paste into chats, emails or screenshots are exposed.** Treat them as shared with everyone who could see that message. Generate fresh ones before real use.

## Good habits

- Generate passcodes with `tools/make-channels.js`, never by hand.
- Rotate passcodes after a competition or when someone leaves a team.
- Keep the table of passcodes outside the repository.
- Rotate the LiveKit API key if the secret was ever shared.
- Run `npm run verify` before every deployment.
