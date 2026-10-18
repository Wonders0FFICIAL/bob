const path = require("path");
const esbuild = require("esbuild");

const root = path.join(__dirname, "..");

esbuild
  .build({
    entryPoints: [path.join(__dirname, "viewer-src", "viewer.js")],
    outfile: path.join(root, "js", "viewer", "bob-viewer.js"),
    bundle: true,
    minify: true,
    format: "esm",
    target: ["es2020"],
    legalComments: "none",
    logLevel: "info",
  })
  .catch(() => process.exit(1));
