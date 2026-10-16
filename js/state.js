export const S = {
  active: null,
  mode: "internet",
  liveSince: null,
  lanOn: false,
  stopDemo: null,
  digitalZoom: false,
  zoom: 0,
  channel: "",
  switchTimer: 0,
};

export const hooks = {
  stopViewer() {},
  sendCommand() { return false; },
};
