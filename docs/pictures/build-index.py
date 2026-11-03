# Builds lib/exercise-pictures.json, the small index Palestra searches when it suggests a picture for an exercise,
# from free-exercise-db (github.com/yuhonas/free-exercise-db, public domain). The pictures themselves are not copied:
# the app loads them from the project's GitHub address when they are first shown, then keeps them for offline use.
# Run: python3 docs/pictures/build-index.py /path/to/free-exercise-db/dist/exercises.json
import json, sys, pathlib
src = json.load(open(sys.argv[1]))
out = []
for x in src:
    if not x.get('images'):
        continue
    out.append([x['id'], x['name'], x.get('equipment') or '', x.get('category') or '', (x.get('primaryMuscles') or [''])[0], len(x['images'])])
dest = pathlib.Path(__file__).resolve().parents[2] / 'lib' / 'exercise-pictures.json'
dest.write_text(json.dumps({'source': 'free-exercise-db', 'license': 'public domain (Unlicense)', 'base': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/', 'items': out}, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
print(len(out), dest.stat().st_size)
