import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..");

let chromium;
for (const name of ["playwright", "playwright-core", "@playwright/test"]) {
  try { ({ chromium } = require(name)); break; } catch {}
}
if (!chromium) {
  for (const p of ["/opt/npm-tools/node_modules/playwright-core", "/opt/node-tools/node_modules/playwright-core"]) {
    try { ({ chromium } = require(p)); break; } catch {}
  }
}
if (!chromium) {
  console.log("Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium");
  process.exit(0);
}

const { createServer } = require("../../tools/dev-server.js");
const { createHandler } = require("../../api/token.js");
const { createLimiter, memoryStore } = require("../../api/_lib/ratelimit.js");
const { makeEnv } = require("../../api/_lib/env.js");
const { createFakeLK } = require("../fakes/livekit.js");

const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const headers = {};
for (const rule of vercel.headers) if (rule.source === "/(.*)") for (const h of rule.headers) headers[h.key] = h.value;

const env = makeEnv({
  LIVEKIT_URL: "https://fake.livekit.cloud",
  LIVEKIT_API_KEY: "APIkey",
  LIVEKIT_API_SECRET: "secretsecretsecretsecretsecret1234",
  BOB_CHANNELS: JSON.stringify([{ id: "bob1", name: "Bob One", camera: "cam-pine-3460", viewer: "view-juniper-8692" }]),
});
const handler = createHandler({ getEnv: () => env, limiter: createLimiter({ fallback: memoryStore(), options: { failLimit: 4 } }), delay: 0 });
const server = createServer(handler, headers);
await new Promise((r) => server.listen(0, r));
const base = "http://localhost:" + server.address().port;

const failures = [];
const check = (ok, label) => { console.log((ok ? "ok   " : "FAIL ") + label); if (!ok) failures.push(label); };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });

let visitor = 0;
async function newPage(ctxOpts = {}) {
  visitor += 1;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { "x-real-ip": "10.0.0." + visitor }, ...ctxOpts });
  const page = await ctx.newPage();
  const problems = { errors: [], csp: [], pageErrors: [] };
  page.on("pageerror", (e) => problems.pageErrors.push(String(e)));
  page.on("console", (m) => {
    const t = m.text();
    if (/Content Security Policy|violates the following/i.test(t)) problems.csp.push(t);
    else if (m.type() === "error" && !/fonts\.(googleapis|gstatic)|youtube|ERR_(NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|CONNECTION|BLOCKED|TUNNEL|PROXY|CERT)|Failed to load resource/i.test(t)) problems.errors.push(t);
  });
  await ctx.route("**/vendor/livekit-client.umd.js", (r) => r.fulfill({ contentType: "text/javascript", body: "window.LivekitClient = (" + createFakeLK.toString() + ")();" }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|youtube/, (r) => r.abort());
  return { ctx, page, problems };
}

{
  const { ctx, page, problems } = await newPage();
  await page.goto(base + "/");
  await page.waitForSelector("#connect");
  check(problems.csp.length === 0, "no CSP violations on load " + problems.csp.join(" | "));
  check(problems.pageErrors.length === 0, "no page errors on load " + problems.pageErrors.join(" | "));

  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.click("#theme");
  const after = await page.evaluate(() => document.documentElement.dataset.theme);
  check(before !== after, "theme toggles " + before + " -> " + after);
  await page.reload();
  check((await page.evaluate(() => document.documentElement.dataset.theme)) === after, "theme survives reload");

  await page.click("#demobtn");
  check((await page.textContent("#badge")) === "Demo", "demo mode starts");
  await page.click("#demobtn");
  check((await page.textContent("#badge")) !== "Demo", "demo mode stops");

  await page.fill("#code", "wrong-code-here");
  await page.click("#connect");
  await page.waitForFunction(() => document.querySelector("#badge").textContent === "Denied");
  check(true, "wrong passcode shows Denied");

  await page.fill("#code", "view-juniper-8692");
  await page.check("#rememberview");
  await page.click("#connect");
  await page.waitForFunction(() => /Waiting/.test(document.querySelector("#badge").textContent));
  check(/Bob One/.test(await page.textContent("#msg")), "viewer joined channel and shows its name: " + (await page.textContent("#msg")));
  const stored = await page.evaluate(() => localStorage.getItem("bob-view-code"));
  check(stored && JSON.parse(stored).c === "view-juniper-8692" && JSON.parse(stored).t > 0, "remembered passcode is saved with a timestamp");
  await page.uncheck("#rememberview");
  check((await page.evaluate(() => localStorage.getItem("bob-view-code"))) === null, "unticking Remember forgets the passcode");

  await page.fill("#code", "wrong-code-here");
  for (let i = 0; i < 6; i++) {
    await page.click("#connect");
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(300);
  const note = await page.textContent("#msg");
  check(/Denied|Too many|Reconnecting/.test(await page.textContent("#badge")) || /Too many/.test(note), "repeated wrong passcodes end in a lockout message: " + note);

  check(problems.csp.length === 0, "no CSP violations during use " + problems.csp.join(" | "));
  check(problems.pageErrors.length === 0, "no page errors during use " + problems.pageErrors.join(" | "));
  await ctx.close();
}

{
  const { ctx, page, problems } = await newPage({ permissions: ["camera"] });
  await page.goto(base + "/#camera");
  await page.waitForSelector("#campanel:not([hidden])");
  check(true, "camera panel opens from #camera");
  await page.fill("#camcode", "cam-pine-3460");
  await page.check("#remembercam");
  await page.click("#camstart");
  await page.waitForFunction(() => /Streaming/.test(document.querySelector("#cammsg").textContent), null, { timeout: 8000 });
  check(/Bob One/.test(await page.textContent("#cammsg")), "camera streams on its channel: " + (await page.textContent("#cammsg")));
  check((await page.evaluate(() => document.querySelector("#camstop").disabled)) === false, "stop button enabled while streaming");
  await page.reload();
  await page.waitForFunction(() => /Streaming/.test(document.querySelector("#cammsg").textContent), null, { timeout: 8000 });
  check(true, "remembered camera restarts itself after reload");
  await page.click("#camstop");
  check((await page.textContent("#cammsg")) === "Camera stopped.", "camera stops");
  check(problems.csp.length === 0, "no CSP violations on camera page " + problems.csp.join(" | "));
  check(problems.pageErrors.length === 0, "no page errors on camera page " + problems.pageErrors.join(" | "));
  await ctx.close();
}

{
  const { ctx, page, problems } = await newPage({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
  await page.goto(base + "/");
  await page.waitForSelector("#connect");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(overflow <= 0, "no horizontal scroll at phone width (overflow " + overflow + "px)");
  check(problems.pageErrors.length === 0, "no page errors on mobile");
  await ctx.close();
}

await browser.close();
server.close();
console.log(failures.length ? "\n" + failures.length + " check(s) failed" : "\nAll smoke checks passed");
process.exit(failures.length ? 1 : 0);
