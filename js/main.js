import { startClock } from "./ui.js";
import { initControl } from "./control.js";
import { initViewer } from "./live/viewer.js";
import { initCamera } from "./live/camera.js";
import { initLens } from "./features/lens.js";
import { initTheme } from "./features/theme.js";
import { initCopyLink } from "./features/copylink.js";
import { initVideo } from "./features/video.js";
import { initDemo } from "./features/demo.js";

startClock();
initControl();
initViewer();
initCamera();
initLens();
initTheme();
initCopyLink();
initVideo();
initDemo();
