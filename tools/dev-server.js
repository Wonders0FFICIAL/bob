const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".webp": "image/webp", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json", ".webmanifest": "application/manifest+json",
};

function shim(res) {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (j) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(j)); return res; };
  return res;
}

function readJson(req) {
  return new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => { b += c; if (b.length > 1e5) req.destroy(); });
    req.on("end", () => { try { resolve(JSON.parse(b)); } catch { resolve({}); } });
  });
}

function createServer(handler, headers = {}) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    if (url.pathname === "/api/token") {
      req.body = await readJson(req);
      return handler(req, shim(res));
    }
    let p = decodeURIComponent(url.pathname);
    if (p === "/") p = "/index.html";
    const file = path.normalize(path.join(ROOT, p));
    if (!file.startsWith(ROOT) || file.includes("node_modules") || file.includes(path.sep + "api" + path.sep)) {
      res.statusCode = 404;
      return res.end("Not found");
    }
    fs.readFile(file, (err, data) => {
      if (err) { res.statusCode = 404; return res.end("Not found"); }
      res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream");
      res.end(data);
    });
  });
}

module.exports = { createServer };

if (require.main === module) {
  const handler = require("../api/token");
  const port = Number(process.env.PORT) || 3000;
  createServer(handler).listen(port, () => console.log("Bob dev server on http://localhost:" + port));
}
