import { createRequire } from "module";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const playwrightPath = process.env.PLAYWRIGHT_PATH || "playwright-core";
const require = createRequire(process.env.PLAYWRIGHT_RESOLVE_FROM || import.meta.url);
const { chromium } = require(playwrightPath);

const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".glb": "model/gltf-binary" };
const server = http
  .createServer((req, res) => {
    const p = req.url.split("?")[0];
    const file = path.join(root, p === "/" ? "index.html" : p);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  })
  .listen(0);
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium",
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
await page.goto(`http://localhost:${port}/`);
const png = await page.evaluate(async () => {
  const { createViewer } = await import("/js/viewer/bob-viewer.js");
  const { SCHEMES, materialFor } = await import("/js/features/model-data.js");
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;left:0;top:0;width:960px;height:600px";
  document.body.append(canvas);
  const v = await createViewer({ canvas, modelUrl: "/models/bob-v3.glb", calm: true });
  const scheme = SCHEMES[0];
  for (const n of v.names()) {
    const m = materialFor(scheme, n);
    if (m) v.setMaterial([n], m);
  }
  await new Promise((r) => setTimeout(r, 400));
  v.render();
  return canvas.toDataURL("image/png");
});
fs.writeFileSync(path.join(root, "models", "bob-v3-poster.png"), Buffer.from(png.split(",")[1], "base64"));
await browser.close();
server.close();
console.log("wrote models/bob-v3-poster.png (convert to webp with: python3 -c ...)");
