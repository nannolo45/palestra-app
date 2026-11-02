# Builds guide-<lang>.html for every language in LANGS from docs/guide/<lang>.md (run: python3 docs/guide/build.py)
# Screenshots are WebP: phone ones in guide/<lang>/ (390×780 at 2×), computer ones in guide/<lang>/desk/.
# Everyday's script, set up for Palestra (APP, THEME_KEY, LANGS, TXT and the colours in the first two CSS lines), with the
# paths at the top of the repository (Palestra has no app/ folder). Convert new screenshots first: python3 docs/guide/webp.py
import markdown, pathlib, html
root = pathlib.Path(__file__).resolve().parents[2]
app = root                     # where index.html lives
APP = 'Palestra'
THEME_KEY = 'palestra-theme'   # where the app keeps its Automatico / Chiaro / Scuro choice
CSS = """
:root{color-scheme:light;--bg:#f3f5f5;--ink:#162021;--muted:#5d696a;--line:#dde3e3;--acc:#7A5A00;--card:#ffffff}
:root.dark{color-scheme:dark;--bg:#151a1b;--ink:#e9eeec;--muted:#94a09f;--line:#313b3c;--acc:#FFD23F;--card:#1f2627}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:720px;margin:0 auto;padding:16px 18px 60px}
h1{font-family:Georgia,serif;font-size:1.9rem;margin:.4em 0}h2{font-family:Georgia,serif;margin-top:2em;border-top:1px solid var(--line);padding-top:1em}
h3{margin-top:1.6em}a{color:var(--acc)}code{background:var(--card);padding:1px 5px;border-radius:5px;font-size:.92em}
img{display:block;max-width:300px;width:100%;margin:14px auto;border:1px solid var(--line);border-radius:18px;box-shadow:0 6px 20px rgba(0,0,0,.18)}
table{border-collapse:collapse;width:100%;font-size:.95em}th,td{text-align:left;vertical-align:top;padding:8px;border-bottom:1px solid var(--line)}th{color:var(--muted);font-weight:600}
.top{display:flex;justify-content:space-between;align-items:center;gap:8px 12px;flex-wrap:wrap;font-size:.95em}.top a{text-decoration:none}
nav.toc{background:var(--card);border-radius:14px;padding:10px 16px;margin:16px 0}nav.toc a{display:block;padding:3px 0;text-decoration:none}
img{cursor:zoom-in}
/* Phone or computer: a class on <html> (chosen at the top, remembered; guessed the first time). Light or dark: the app's own choice. */
/* (v62) the two choices at the top are dropdowns: how to read (phone / computer) and the language */
.top .pick{display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-size:.9em}
.top select{font:inherit;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:10px;padding:6px 28px 6px 10px;appearance:none;background-image:linear-gradient(45deg,transparent 50%,var(--muted) 50%),linear-gradient(135deg,var(--muted) 50%,transparent 50%);background-position:calc(100% - 15px) 55%,calc(100% - 10px) 55%;background-size:5px 5px;background-repeat:no-repeat;cursor:pointer}
.top .picks{display:flex;gap:10px;flex-wrap:wrap}
html:not(.desk) .dk,html:not(.desk) .desk-only,html.desk .ph,html.desk .phone-only{display:none}
html.desk main{max-width:1080px;padding:24px 32px 80px}
html.desk main>p,html.desk main>ul,html.desk main>ol,html.desk main>table,html.desk main>h2,html.desk main>h3,html.desk main>div,html.desk nav.toc{max-width:780px;margin-left:auto;margin-right:auto}
html.desk nav.toc{columns:2;column-gap:24px}
html.desk main>p:has(img.dk),html.desk main>p:has(img.wide){max-width:none}
html.desk img.dk,html.desk img.wide{max-width:100%;border-radius:12px;margin:18px auto 26px}
html.desk .desk-only{background:var(--card);border-radius:14px;padding:2px 16px}
.zoom{position:fixed;inset:0;z-index:9;background:rgba(0,0,0,.86);display:flex;align-items:center;justify-content:center;padding:2vw;cursor:zoom-out}
.zoom img{max-width:100%;max-height:100%;width:auto;margin:0;border:0;box-shadow:none;cursor:zoom-out}
"""
# Every language the guide is written in (add a line and a docs/guide/<lang>.md for one more).
LANGS = {'it': 'Italiano', 'en': 'English'}
TXT = {'en': ('← Back to the app', 'Phone', 'Computer', 'Show the guide for', 'Language'),
       'it': ("← Torna all'app", 'Telefono', 'Computer', 'Mostra la guida per', 'Lingua')}
for lang in LANGS:
    back, phoneL, deskL, modeLabel, langLabel = TXT[lang]
    md = (root / 'docs/guide' / f'{lang}.md').read_text(encoding='utf8')
    body = markdown.markdown(md, extensions=['tables', 'toc', 'md_in_html'], extension_configs={'toc': {'toc_depth': '2-2'}})
    # a small table of contents
    import re
    toc = ''.join(f'<a href="#{m.group(1)}">{html.unescape(m.group(2))}</a>' for m in re.finditer(r'<h2 id="([^"]+)">(.*?)</h2>', body))
    page = f'''<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{APP} · {({'it': 'Guida', 'de': 'Anleitung'}).get(lang, 'Guide')}</title><script>(function(){{var m;try{{m=localStorage.getItem('guideMode')}}catch(e){{}}var w=innerWidth,d=m?m==='desk':w>=1000||(w>=700&&matchMedia('(pointer:fine)').matches);if(d)document.documentElement.classList.add('desk');var t='auto';try{{t=localStorage.getItem('{THEME_KEY}')||'auto'}}catch(e){{}}document.documentElement.classList.add(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light')}})()</script><style>{CSS}</style></head>
<body><main><div class="top"><a href="./#/settings">{back}</a><span class="picks"><label class="pick"><span>{modeLabel}</span><select id="mode" aria-label="{modeLabel}"><option value="phone">📱 {phoneL}</option><option value="desk">💻 {deskL}</option></select></label><label class="pick"><span>{langLabel}</span><select id="lang" aria-label="{langLabel}">{''.join(f'<option value="guide-{k}.html"{" selected" if k == lang else ""}>{v}</option>' for k, v in LANGS.items())}</select></label></span></div>{body.replace('<h1>', '<h1>', 1)}</main></body></html>'''
    # on a computer the guide shows the wide-screen screenshots (guide/<lang>/desk/*.webp), when there is one
    from PIL import Image
    def pic(m):
        tag, src = m.group(0), m.group(1)
        name = pathlib.Path(src).stem
        desk = app / 'guide' / lang / 'desk' / f'{name}.webp'
        try: w, h = Image.open(app / src).size
        except Exception: w, h = (1, 2)
        if w > h: tag = tag.replace('<img ', '<img class="wide" ', 1)
        tag = tag.replace('<img ', '<img loading="lazy" ', 1)
        if not desk.exists(): return tag
        dk = re.sub(r'src="[^"]+"', f'src="guide/{lang}/desk/{name}.webp"', tag).replace('<img ', '<img class="dk" ', 1)
        return tag.replace('<img ', '<img class="ph" ', 1) + dk
    page = re.sub(r'<img [^>]*src="(guide/[^"]+\.(?:png|webp))"[^>]*>', pic, page)
    # click a picture to see it big; click again (or Esc) to close
    page = page.replace('</body>', '''<script>
document.addEventListener('click',function(e){var z=document.querySelector('.zoom');if(z){z.remove();return;}var i=e.target.closest('main img');if(!i)return;var d=document.createElement('div');d.className='zoom';var b=document.createElement('img');b.src=i.currentSrc||i.src;b.alt=i.alt;d.appendChild(b);document.body.appendChild(d);});
function setMode(m,keep){document.documentElement.classList.toggle('desk',m==='desk');var s=document.getElementById('mode');if(s)s.value=m;if(keep){try{localStorage.setItem('guideMode',m)}catch(e){}}}
setMode(document.documentElement.classList.contains('desk')?'desk':'phone',false);
document.getElementById('mode').addEventListener('change',function(e){setMode(e.target.value,true);});
document.getElementById('lang').addEventListener('change',function(e){location.href=e.target.value+location.hash;});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){var z=document.querySelector('.zoom');if(z)z.remove();}});
</script></body>''', 1)
    page = page.replace('</h1>', f'</h1><nav class="toc">{toc}</nav>', 1)
    (app / f'guide-{lang}.html').write_text(page, encoding='utf8')
    print(lang, len(page))
