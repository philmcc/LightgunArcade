import json
from pathlib import Path
path = Path('package-lock.json')
data = json.loads(path.read_text())
EMPTY = []

if 'packages' in data:
    for key, pkg in data['packages'].items():
        if pkg.get('version', None) == '':
            EMPTY.append(f"packages[{key}]")

def walk(obj, path='root'):
    if isinstance(obj, dict):
        if obj.get('version', None) == '':
            EMPTY.append(path)
        for k,v in obj.items():
            walk(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for idx,v in enumerate(obj):
            walk(v, f"{path}[{idx}]")

walk(data)
for item in EMPTY:
    print(item)
print('total', len(EMPTY))
