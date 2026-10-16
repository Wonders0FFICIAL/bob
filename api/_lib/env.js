const clean = (v) => String(v == null ? "" : v).trim().replace(/^["']+|["']+$/g, "").trim();

function makeEnv(source) {
  return (k) => clean(source[k]);
}

module.exports = { clean, makeEnv };
