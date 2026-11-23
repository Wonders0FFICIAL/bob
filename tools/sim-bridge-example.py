#!/usr/bin/env python3
"""
Example bridge for the BOB rescue simulator.

How it works
  1. You run this program. It is a WebSocket SERVER on ws://localhost:8765.
  2. In the simulator press "Link", type ws://localhost:8765 and press Connect
     (or open the sim with ?ws=ws://localhost:8765 in the address).
  3. This program sends a heartbeat + drive commands 20 times a second and
     prints what the robot reports back.

Replace drive_logic() with YOUR real drive code (the same function you will
later run on the real BOB). Install the one dependency first:
    pip install websockets
"""
import asyncio, json, sys, time
import websockets

HOST, PORT = "localhost", 8765


def drive_logic(tel, t):
    """Given the latest telemetry dict and seconds since start, return a command dict.
    This tiny demo drives forward 2.5 s, turns left 1.5 s, then stops."""
    if t < 2.5:
        return {"t": "cmd_vel", "lin": 0.30, "ang": 0.0}      # metres/second, radians/second
    if t < 4.0:
        return {"t": "cmd_vel", "lin": 0.0, "ang": 1.0}
    return {"t": "cmd_vel", "lin": 0.0, "ang": 0.0}


async def session(ws):
    print("sim connected")
    latest = {}
    t0 = time.time()
    armed = False

    async def reader():
        async for raw in ws:
            m = json.loads(raw)
            if m.get("t") == "tel":
                latest.update(m)
            elif m.get("t") == "thermal":
                latest["thermal_hot_pixels"] = m["hot"]   # 32x24 frame is in m["data"] (base64)
    task = asyncio.create_task(reader())
    try:
        n = 0
        while True:
            await ws.send(json.dumps({"t": "hb"}))              # heartbeat: must arrive at least every 500 ms
            st = latest.get("state")
            if st == "READY" and not armed:
                await ws.send(json.dumps({"t": "arm"}))         # arming is a deliberate step, like the real robot
                armed = True
                t0 = time.time()                                # start the demo script from the moment we arm
            if st == "ARMED":
                await ws.send(json.dumps(drive_logic(latest, time.time() - t0)))
            if st in ("STOP", "SAFE"):
                armed = False                                   # after a failsafe you must arm again
            n += 1
            if n % 10 == 0 and latest:
                p, pw = latest["pose"], latest["power"]
                print(f"{st:6s} x={p['x']:+.2f} y={p['y']:+.2f} yaw={p['yaw']:+.2f} "
                      f"{pw['volts']:.1f}V {pw['amps']:.1f}A dmg={latest['damage']:.0f}% range={latest['range']}")
            await asyncio.sleep(0.05)
    except websockets.ConnectionClosed:
        print("sim disconnected")
    finally:
        task.cancel()


async def main():
    async with websockets.serve(session, HOST, PORT):
        print(f"Listening on ws://{HOST}:{PORT}  (press Link in the simulator)")
        await asyncio.Future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
