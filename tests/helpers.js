const { makeEnv } = require("../api/_lib/env");

const BASE = {
  LIVEKIT_URL: "https://demo.livekit.cloud",
  LIVEKIT_API_KEY: "APIkey123",
  LIVEKIT_API_SECRET: "secretsecretsecretsecretsecret1234",
};

const CHANNELS = JSON.stringify([
  { id: "bob1", name: "Bob One", camera: "pine-onyx-3460", viewer: "juniper-badger-8692" },
  { id: "bob2", name: "Bob Two", camera: "amber-grove-3427", viewer: "kestrel-juniper-9776" },
]);

function mockRes() {
  const res = { headers: {}, statusCode: 0, body: null };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (j) => { res.body = j; return res; };
  return res;
}

function mockReq(body, extra = {}) {
  return { method: "POST", headers: { host: "bob.example.org", "x-real-ip": "1.2.3.4" }, body, ...extra };
}

function jwt(token) {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
}

function envWith(extra) {
  return () => makeEnv({ ...BASE, ...extra });
}

module.exports = { BASE, CHANNELS, mockRes, mockReq, jwt, envWith };
