# Bob CAD

`bob_v3.py` builds the concept model of Bob in millimetres (x forward, y left, z up).

```
pip install build123d
python3 bob_v3.py          # bob_v3.step and bob_v3.stl, hangar doors open
python3 bob_v3.py --web    # ../models/bob-v3.glb for the website, doors closed
```

Import `bob_v3.step` into Onshape (Create, Import, "Import to a single document") to edit it there.
The sizes at the top of the file are estimates. Replace them with the real wheel, motor and phone sizes once you have the parts.

`drone_pip.py` builds Pip, the micro-drone that rides in the hangar. `bob_v3.py` imports it and parks it inside the hangar, so building Bob rebuilds Pip too.

```
python3 drone_pip.py          # pip.step and pip.stl
python3 drone_pip.py --web    # ../models/pip.glb for the website
```
