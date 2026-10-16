# Deployment guide

This guide takes you from nothing to a working Bob control room at your own address. It assumes you have never deployed a website before. Do the parts in order and keep a notes file open, because you will copy a few values between services.

You will use three free services:

| Service | What it does |
|---|---|
| **LiveKit Cloud** | Carries the live video between the phone on Bob and the PC. |
| **GitHub** | Stores the website files. |
| **Vercel** | Turns those files into a real HTTPS website and runs the small passcode server. |

---

## 1. LiveKit (the video service)

1. Go to **cloud.livekit.io** and sign up.
2. Create a **project** and name it `bob`.
3. Open the project's **Settings**. You need three values:
   - **URL**, like `wss://bob-abc123.livekit.cloud`. If it starts with `https://`, either form works. The server converts it.
   - **API Key**, starts with `API`.
   - **API Secret**, a long random string. Treat it like a password.
4. Open **Keys** inside Settings. If no key exists, press **Create key**. Copy the key and secret into your notes straight away. The secret may be shown only once. If you lose it, create a new key and use that one everywhere.
5. Make sure the key and the secret you copy belong to the **same** key row. A mismatch is the most common setup mistake and shows up as a 401 error in the browser console.

Free plan limits at the time of writing: 5,000 participant-minutes a month, 100 concurrent participants, 50 GB of downstream data. A participant-minute is one device connected for one minute, so one phone plus one PC streaming for an hour uses 120 minutes. Check LiveKit's pricing page for current numbers.

## 2. GitHub (store the files)

1. Make a free account at **github.com** and create a **private** repository called `bob`.
2. Put the contents of this folder into the repository. If the website files live in a sub-folder (for example `bob_site/`), remember that folder name for step 3.
3. In VS Code: open the folder, press **Source Control**, write a message, **Commit**, then **Sync Changes**.

Do not commit a `node_modules` folder. Add this line to your `.gitignore` file (create the file if you do not have one):

```
node_modules
```

## 3. Vercel (make it a website)

1. Go to **vercel.com** and sign up with **Continue with GitHub**.
2. **Add New… → Project**, pick the `bob` repository, press **Import**.
3. **Root Directory**: if the website files are inside a sub-folder, press **Edit** and choose it (for example `bob_site`). If you skip this you will see a 404 `NOT_FOUND` page or a build error about a directory that does not exist.
4. Leave the framework preset as **Other**. Do not change the build settings.
5. Open **Environment Variables** and add the variables from the next section, then **Deploy**.

## 4. Environment variables

Add these in Vercel under **Settings → Environment Variables**. After you add or change any variable you must **redeploy** (Deployments → the latest one → ⋯ → Redeploy), otherwise the change does not apply.

| Name | Required | What it is |
|---|---|---|
| `LIVEKIT_URL` | yes | Your LiveKit URL from step 1. |
| `LIVEKIT_API_KEY` | yes | Your LiveKit API key. |
| `LIVEKIT_API_SECRET` | yes | Your LiveKit API secret. |
| `BOB_CHANNELS` | yes | The list of robots and their passcodes. See section 5. |
| `BOB_TOKEN_TTL` | no | How long a join ticket lasts, such as `10m` or `1h`. Default `30m`. Tickets are only needed to join, and devices fetch a new one whenever they reconnect. |
| `ALLOWED_ORIGINS` | no | Extra websites allowed to call the passcode server, comma separated. Leave empty unless you host the page somewhere else. |
| `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` | no | A shared store for the rate limiter. See section 8. `KV_REST_API_URL` and `KV_REST_API_TOKEN` work too. |

The older pair `BOB_VIEWER_PASSCODE` and `BOB_CAMERA_PASSCODE` still works for a single robot when `BOB_CHANNELS` is not set. Once `BOB_CHANNELS` exists, those two are ignored and you can delete them.

## 5. Robots, channels and passcodes

Each robot gets its own **channel**: one passcode for the phone on the robot, one for the PC in the control room. The passcode decides which channel a device joins, so owners only ever see their own camera, wherever in the world they are.

Generate the passcodes on your own computer (needs Node.js from nodejs.org):

```
node tools/make-channels.js "bob1" "bob2" "bob3"
```

It prints one long line and a table. Then:

1. Copy the long line into the `BOB_CHANNELS` variable in Vercel.
2. Save the table somewhere private, and hand each owner their own two passcodes.
3. Redeploy.

Rules the server enforces:

- Every passcode must be unique, and at least 8 characters. The generated ones are about 34 bits of randomness.
- A channel id is 1 to 32 letters, numbers or dashes.
- A bad `BOB_CHANNELS` value produces a readable message in the control room instead of failing silently.

**Adding a robot later:** do not rerun the generator for everyone, because that gives everyone new passcodes. Add one more entry before the final `]` of the existing value:

```
,{"id":"bob4","name":"bob4","camera":"some-long-passcode-1","viewer":"another-long-passcode-2"}
```

**Removing access:** delete that entry and redeploy. Existing connections end within the ticket lifetime at the latest, and nobody can rejoin.

## 6. Connect your domain

1. Vercel project → **Settings → Domains** → add your address, for example `bob.jrofficial.org`.
2. Vercel shows a DNS record, usually a **CNAME** such as `cname.vercel-dns.com`. Use exactly what Vercel shows.
3. At your DNS provider (Namecheap: Domain List → Manage → Advanced DNS; Cloudflare: DNS) add:
   - Type **CNAME**, Host `bob`, Value the one Vercel showed.
   - On Cloudflare set the record to **DNS only** (grey cloud), not proxied.
4. Wait for the tick in Vercel. This can take a few minutes up to a few hours. HTTPS is automatic.

## 7. Try it with a phone and a PC

**Phone on Bob** (Chrome on Android recommended):

1. Open `https://your-address/#camera`.
2. Enter the channel's **phone** passcode, press **Start camera**, allow camera access.
3. Tick **Remember** if the phone should restart by itself next time. Only do this on a device that belongs to the robot.
4. Keep the tab open and in front, with the screen on. Charging is not required but helps on long runs.

**PC in the control room:**

1. Open `https://your-address`, go to the control room.
2. Enter the channel's **PC** passcode and press **Connect**.
3. The picture appears within a few seconds, and the channel name is shown under the status.

## 8. Optional: a shared rate limit store

The passcode server limits wrong guesses to 8 per 15 minutes per address, and 60 requests a minute. Out of the box the counters live in memory. Vercel may run several copies of the server and restart them whenever it likes, so the limit is best effort and an attacker can get a few extra tries.

To make the limit exact and shared:

1. Vercel dashboard → **Storage** → create an **Upstash Redis** database (the free tier is enough) and connect it to this project. The names in Vercel's menus change over time, so look for Upstash under the marketplace.
2. The connection adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or the `UPSTASH_REDIS_REST_*` pair) to the project automatically.
3. Redeploy. No code change is needed.

If the store is unreachable, the server falls back to the in-memory counters and logs the problem, so a Redis outage never locks your team out.

## 9. Using your own LiveKit domain

The security policy shipped in `vercel.json` only allows connections to `*.livekit.cloud`. If you later move to a self-hosted LiveKit, add your domain to `connect-src` in `vercel.json`, for example `wss://livekit.example.org https://livekit.example.org`, and redeploy.

## 10. Automated checks

```
npm install
npm run verify      # syntax and wiring checks, then every unit test
npm run e2e         # optional, drives a real browser (needs Playwright)
npm run dev         # local server at http://localhost:3000 with the real passcode API
```

To run the checks on every push, copy `ci/github-workflow.yml` to `.github/workflows/ci.yml` at the **root of the repository** (not inside the website folder), and adjust `working-directory` if your website folder is not called `bob_site`.

For `npm run dev`, set the variables in your terminal first, for example on macOS or Linux (on Windows PowerShell use `$env:NAME="value"`):

```
export LIVEKIT_URL=wss://your-project.livekit.cloud LIVEKIT_API_KEY=APIxxxx LIVEKIT_API_SECRET=xxxx BOB_CHANNELS='[...]'
```

## 11. Troubleshooting

| What you see | Cause and fix |
|---|---|
| Vercel page says **404 NOT_FOUND** | Wrong Root Directory, or the build failed. Fix Settings → General → Root Directory, redeploy. |
| Build error: Root Directory does not exist | The folder name in Vercel does not match the folder in the repository. Match the capital letters and underscores exactly. |
| "Server is not configured yet. Missing: …" | A variable is missing or you did not redeploy after adding it. |
| "BOB_CHANNELS is not valid JSON" | A quote or comma was lost when pasting. Paste the generator's single line again. |
| "Wrong passcode." | Wrong passcode for that role. The phone and the PC have different passcodes. |
| "Too many wrong passcodes. Try again in N minutes." | That address was locked out after repeated mistakes. Wait, or use another network. |
| "Couldn't start. Retrying…" with a 401 in the browser console | LiveKit key and secret do not belong together. Create a new key and update both variables. |
| "Waiting for Bob's camera" | The PC is connected, the phone has not started yet. |
| "Another device took over as Bob's camera" | A second phone started with the same camera passcode. Only one camera per channel is allowed. |
| Black or frozen picture | Close the phone tab, reopen, press Start camera again. |
| Page loads but nothing connects after you changed LiveKit domain | The security policy blocks it. See section 9. |
| Local network mode is blocked on the live site | The browser forbids an `http` camera on an `https` page. Use Internet mode, or run `npm run dev` and open `http://localhost:3000`. |

## 12. Check on real devices before a competition

The automated tests prove the logic. They cannot prove your phone's camera, your network or LiveKit's servers. Before you rely on Bob, tick these off with the real phone and PC:

- [ ] Start the camera, connect the PC, confirm the picture and the channel name.
- [ ] Press the camera switch button: front and back cameras change and the picture recovers.
- [ ] Press zoom: the picture zooms (optical on phones that support it, digital otherwise).
- [ ] Turn on airplane mode on the phone for 20 seconds and turn it off: the PC shows waiting or reconnecting, then the picture returns by itself.
- [ ] Turn off Wi-Fi on the PC for 20 seconds: the PC recovers by itself.
- [ ] Open the control room on a second PC at the same time: both show the picture.
- [ ] Start the camera on a second phone with the same passcode: the first phone stops with the takeover message and the PC switches to the second phone.
- [ ] Leave it running for longer than one ticket lifetime (default 30 minutes), then drop and restore the network. It must still reconnect.
- [ ] Leave the phone running with the screen on for the length of a real run and note the battery drop.
- [ ] Try a wrong passcode 9 times and confirm the lockout message appears.
