export const $ = (id) => document.getElementById(id);

export const el = {
  feed: $("feed"),
  rtc: $("rtc"),
  badge: $("badge"),
  msg: $("msg"),
  ph: $("placeholder"),
  urlInput: $("url"),
  phTitle: $("phtitle"),
  phText: $("phtext"),
  hud: $("hud"),
  clock: $("clock"),
  elapsed: $("elapsed"),
  flip: $("flip"),
  zoomIn: $("zoomin"),
  zoomOut: $("zoomout"),
};

export const pad = (n) => String(n).padStart(2, "0");
