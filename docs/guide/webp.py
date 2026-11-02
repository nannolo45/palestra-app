# Turns the PNG screenshots into WebP (quality 82), as Everyday's docs/guide/webp.py:
#   python3 docs/guide/webp.py                 the phone ones in guide/<lang>/*.png, in place (the PNG is removed)
#   python3 docs/guide/webp.py --desk DIR      the computer ones in DIR/<lang>/*.png into guide/<lang>/desk/*.webp
import pathlib, sys
from PIL import Image
root = pathlib.Path(__file__).resolve().parents[2]
args = sys.argv[1:]
for lang in ('it', 'en'):
    for f in sorted((root / 'guide' / lang).glob('*.png')):
        Image.open(f).convert('RGB').save(f.with_suffix('.webp'), 'WEBP', quality=82, method=6)
        f.unlink()
    if '--desk' in args:
        src = pathlib.Path(args[args.index('--desk') + 1]) / lang
        out = root / 'guide' / lang / 'desk'
        out.mkdir(parents=True, exist_ok=True)
        for f in sorted(src.glob('*.png')):
            Image.open(f).convert('RGB').save(out / f'{f.stem}.webp', 'WEBP', quality=82, method=6)
print('ok')
