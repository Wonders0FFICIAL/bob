import { initTheme } from "../features/theme.js";
import { initLens } from "../features/lens.js";

initTheme();
initLens();

const path = decodeURIComponent(location.pathname + location.search).slice(0, 60);
const out = document.getElementById("nfpath");
if (path && path !== "/") out.textContent = path;
