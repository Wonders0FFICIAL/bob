# Bob CAD

`bob_v2.py` builds the concept model of Bob in millimetres (x forward, y left, z up).

```
pip install build123d
python3 bob_v2.py          # bob_v2.step and bob_v2.stl, hangar doors open
python3 bob_v2.py --web    # ../models/bob-v2.glb for the website, doors closed
```

Import `bob_v2.step` into Onshape (Create, Import, "Import to a single document") to edit it there.
The sizes at the top of the file are estimates. Replace them with the real wheel, motor and phone sizes once you have the parts.
