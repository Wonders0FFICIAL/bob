# The simulation page (/simulation): connecting your real code

The simulator can be driven by your own program instead of the keyboard. Your program sends
**commands** and receives **telemetry**. The idea is that the same drive code can later run on the
real BOB with only the transport changed.

## Three ways to connect

1. **WebSocket (recommended for real code).** Your program is the *server*; the simulator page is the *client*.
   - In the sim press **Link**, type e.g. `ws://localhost:8765`, press **Connect**.
   - Or open the page with `?ws=ws://localhost:8765` and it connects by itself.
   - Run `python3 tools/sim-bridge-example.py` (needs `pip install websockets`) for a working example.
   - Browser rule: a page served over `https://` may only connect to `wss://...` or to `ws://localhost`.
     For a bridge on another machine, put it behind TLS (`wss://`).
2. **postMessage (website embed).** Put the sim in an `<iframe>` on your site; the parent page sends
   commands with `iframe.contentWindow.postMessage({t:'hb'}, '*')` and listens for `message` events
   carrying telemetry objects. Add `?origin=https://your-site.example` to the sim URL to only accept your page.
3. **JavaScript API on the same page:** `BOB_SIM.command(obj)`, `BOB_SIM.telemetry()`, `BOB_SIM.thermal()`,
   `BOB_SIM.subscribe(fn)`, `BOB_SIM.connect(url)`, `BOB_SIM.disconnect()`.

All messages are JSON objects with a `t` field. Units are SI: metres, seconds, radians, volts, amps.

## Safety state machine (like the real robot)

`SAFE` (no heartbeat) -> `READY` (heartbeat arriving) -> `ARMED` (you sent `arm`) -> `STOP` (failsafe tripped) -> `READY`.

- Send `{"t":"hb"}` at least every **500 ms**, otherwise the robot stops (`STOP`). Any command also counts as a heartbeat.
- Commands that move things are ignored unless the state is `ARMED`.
- Failsafe also trips when the body tilts more than 45 degrees, the battery is below 9.3 V, or damage reaches 100%.
- After `STOP` you must send `arm` again once the state is back to `READY`.
- If the link is silent for 3 s (and no socket is open) the sim returns to keyboard control.

## Commands (you -> sim)

| message | meaning |
|---|---|
| `{"t":"hb"}` | heartbeat |
| `{"t":"arm"}` / `{"t":"disarm"}` | arm (only from `READY`) / back to `READY` |
| `{"t":"cmd_vel","lin":0.3,"ang":0.0}` | drive: `lin` m/s forward, `ang` rad/s counter-clockwise (left turn). Top speed is about 0.5 m/s. In physics mode the turn rate you get is lower than commanded (skid steer scrubs), like the real robot. |
| `{"t":"drive","l":0.5,"r":0.5}` | raw left/right motor duty, -1 to 1 |
| `{"t":"pip","a":"launch"}` / `"land"` / `"drop"` | Pip actions (launch needs Bob stopped and level) |
| `{"t":"pip_cmd","f":0,"sx":0,"yaw":0,"up":0}` | fly Pip: forward, strafe left, yaw left, up, each -1 to 1 (send at ~20 Hz) |
| `{"t":"flap"}` | toggle the cargo flap (Bob must be stopped) |
| `{"t":"reset"}` | reset the run |
| `{"t":"mission"}` | start a scored mission |

## Telemetry (sim -> you), about 20 Hz

```json
{"t":"tel","ts":123456,"state":"ARMED",
 "pose":{"x":1.2,"y":0.0,"yaw":0.1},
 "imu":{"pitch":0.02,"roll":0.0,"yaw_rate":0.0,"ax":0.0,"ay":0.0},
 "vel":{"lin":0.3,"ang":0.0},"wheels":{"left":0.3,"right":0.3},
 "joints":{"rocker":0.0,"bogie_l":0.0,"bogie_r":0.0},
 "power":{"volts":12.5,"amps":1.6,"soc":0.99},
 "load":0.1,"slip":0.0,"damage":0,"fault":null,"tipped":false,
 "range":[2.0,2.0,2.0],
 "pip":{"state":"docked","x":0,"y":0,"z":0,"yaw":0},"packets":3,"flap":0,
 "mission":{"on":false,"time":0,"found":false,"delivered":false,"medicine":false,"done":false,"score":null}}
```

- `pose` is the simulator's ground truth. On the real robot you will not have this, so treat it like a
  motion-capture reference (use it to check your odometry, not to drive).
- `range` is the three bumper ultrasonic sensors (left, centre, right), metres, 2.0 means nothing seen.
- Thermal camera, about 4 Hz: `{"t":"thermal","w":32,"h":24,"src":"bob","hot":30,"data":"<base64>"}`.
  `data` is 32x24 bytes, row-major from the top-left, 0 = cold, 255 = hottest. `hot` counts very hot pixels
  (the casualty). `src` says whether it is Bob's camera or Pip's.

## What is in the simulator

- **Arenas** (Mission panel): *Open course* (the default), *Slalom* (eight gates 400 mm apart on a curved line, two low bumps, barrels, casualty past the finish) and *Rubble* (logs and blocks up to 56 mm, debris around the casualty, a cone cordon). Each has a seed, so a layout can be repeated.
- **Cones**: 40 physical cones. They tip about their rim, slide when pushed, and can be knocked over by Bob or Pip. Hits count in the mission score and are kept in the replay.
- **Casualty**: a jointed model (pelvis, spine, chest, neck, head, arms with fingers, legs) with a slab on the shins, a vest with reflective bands, a helmet, a breathing animation and a hand wave. It carries heat tags, so it shows up in the thermal view.
- **Cameras** (camera button): Cinematic (auto director), Chase, Driver, Wheel, Pip follow, Top and Free. They use spring smoothing, speed based field of view and collision clamping. Camera shake and shadows can be turned off in Settings.
- **Sound**: synthesised from the real parts: JGB37-520 motor whine (pitch follows wheel speed, louder under load), MG90S servo chirps for the cargo flap, relay click on arm and disarm, buzzer beeps, ducted-fan noise for Pip, plus impacts for walls, barrels and cones. Volume and mute are in Settings.
- **Hardware panel**: live motor, battery and current figures, with a *Real parts* preset (66 rpm motors with 100 mm wheels, about 0.345 m/s, 5.4 kg). Motor torque is still an estimate.
- **Settings**: quality, shadows, effects, shake, volume. They are stored in the browser.

The sim code is split into `js/sim/main.js` (loop, physics, cameras, mission), `arenas.js`, `cones.js`, `human.js`, `audio.js` and `ui.js`.

## Honest limits

- The sim is a simplified model (the numbers for mass, motor torque, grip and battery are assumptions).
  Do not tune real-robot gains on it without checking on the robot.
- Timing is browser timing. It is fine for testing logic, not for hard real-time claims.

## Notes for the website

- The page lives in `simulation.html`, `simulation.css` and `js/sim/*.js`. It uses three.js r128 from `vendor/` because the sim was written for that version; the 3D model panel on the home page uses its own newer build, so the two do not conflict.
- The Content-Security-Policy allows `ws://localhost:*` and `ws://127.0.0.1:*` so the page can talk to a program on the same computer. A bridge on another machine needs `wss://` and an extra `connect-src` entry.
- The sim cannot be framed by other sites (the site sets `frame-ancestors 'none'`), so the postMessage route only matters if you later change that.
