# Bob CAD

`bob_v3.py` builds the concept model of Bob in millimetres (x forward, y left, z up).

```
pip install build123d
python3 bob_v3.py          # bob_v3.step and bob_v3.stl, hangar doors open
python3 bob_v3.py --web    # ../models/bob-v3.glb for the website, doors closed
```

Import `bob_v3.step` into Onshape (Create, Import, "Import to a single document") to edit it there.
The sizes at the top of the file are estimates. Replace them with the real wheel, motor and phone sizes once you have the parts.
