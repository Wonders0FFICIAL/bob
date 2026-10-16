import { $ } from "../dom.js";

const BOB_VIDEO = "https://youtube.com/shorts/W0G0fOATsiU?si=inoGqdqjGMiIEF7s";

export function youtubeId(raw) {
  const m = String(raw).trim().match(/(?:shorts\/|youtu\.be\/|v=|embed\/)([\w-]{11})/) || String(raw).trim().match(/^([\w-]{11})$/);
  return m ? m[1] : null;
}

export function initVideo() {
  const section = $("watch"), nav = $("watchnav"), frame = $("yt"), out = $("ytlink");
  const id = youtubeId(BOB_VIDEO);
  if (!id) return;
  frame.src = "https://www.youtube-nocookie.com/embed/" + id + "?rel=0&playsinline=1";
  out.href = "https://www.youtube.com/shorts/" + id;
  section.hidden = false;
  nav.hidden = false;
}
