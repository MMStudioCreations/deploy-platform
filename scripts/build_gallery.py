"""Builds templates/gallery.html: a local browsable gallery of every processed template.

Usage (from deploy-platform/):
    python scripts/build_gallery.py
    python -m http.server 8765 --directory templates
    then open http://localhost:8765/gallery.html
"""
import html
import json
import os
import re

ROOT = os.path.join(os.path.dirname(__file__), "..", "templates")
SERVER_TEMPLATE = re.compile(r"\{%|<\?php|@extends|@section\(")


def load(id_):
    folder = os.path.join(ROOT, "processed", id_)
    try:
        with open(os.path.join(folder, "schema.json"), encoding="utf-8") as f:
            schema = json.load(f)
    except (OSError, ValueError):
        schema = {}
    try:
        with open(os.path.join(folder, "index.html"), encoding="utf-8", errors="ignore") as f:
            head = f.read(200_000)
    except OSError:
        head = ""
    sections = schema.get("sections", [])
    return {
        "fields": sum(len(s.get("fields", [])) for s in sections),
        "sections": len(sections),
        "broken": bool(SERVER_TEMPLATE.search(head)) or "node_modules" in head[:2000],
    }


def build():
    with open(os.path.join(ROOT, "manifest.json"), encoding="utf-8") as f:
        manifest = json.load(f)

    cards = []
    categories = set()
    broken = 0
    for t in manifest:
        info = load(t["id"])
        broken += info["broken"]
        categories.add(t["category"])
        name = re.sub(r"\s+\d{4}\s\d{2}\s\d{2}.*$", "", t["name"])  # drop "2026 01 21 ... Utc" suffix
        cards.append(f"""
<article class="card{' broken' if info['broken'] else ''}" data-cat="{html.escape(t['category'])}" data-name="{html.escape(name.lower())}">
  <a class="frame" href="processed/{html.escape(t['id'])}/index.html" target="_blank" rel="noopener">
    <iframe loading="lazy" src="processed/{html.escape(t['id'])}/index.html" tabindex="-1" title="{html.escape(name)} preview"></iframe>
  </a>
  <div class="meta">
    <h2>{html.escape(name)}</h2>
    <p><span class="cat">{html.escape(t['category'])}</span> · {info['sections']} sections · {info['fields']} editable fields</p>
    {'<p class="warn">Built from a server template page; preview shows raw code. Needs re-processing.</p>' if info['broken'] else ''}
    <p class="links"><a href="processed/{html.escape(t['id'])}/index.html" target="_blank" rel="noopener">Open preview</a> · <a href="processed/{html.escape(t['id'])}/schema.json" target="_blank" rel="noopener">Schema</a></p>
  </div>
</article>""")

    chips = "".join(f'<button class="chip" data-cat="{html.escape(c)}">{html.escape(c)}</button>' for c in sorted(categories))
    page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Template Library</title>
<style>
:root{{--bg:#f4f3f1;--surface:#fff;--fg:#1c1b1a;--muted:#6f6a66;--line:#dfdbd6;--accent:#1f4f8a;--warn:#a5520a;--warn-bg:#fbefe3}}
@media (prefers-color-scheme:dark){{:root{{--bg:#141414;--surface:#1d1d1d;--fg:#ecebe9;--muted:#a19c97;--line:#333;--accent:#8fb4ea;--warn:#f0a35c;--warn-bg:#2c2118}}}}
*{{box-sizing:border-box}} body{{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif;padding:24px 16px 64px}}
header{{max-width:1400px;margin:0 auto 18px;display:grid;gap:10px}}
h1{{margin:0;font-size:28px}} .sub{{color:var(--muted);margin:0}}
.controls{{display:flex;flex-wrap:wrap;gap:8px;align-items:center}}
input[type=search]{{padding:8px 10px;border:1px solid var(--line);background:var(--surface);color:var(--fg);border-radius:6px;min-width:240px}}
.chip{{border:1px solid var(--line);background:var(--surface);color:var(--fg);padding:5px 10px;border-radius:999px;cursor:pointer;font-size:13px}}
.chip.on{{background:var(--accent);border-color:var(--accent);color:#fff}}
main{{max-width:1400px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px}}
.card{{background:var(--surface);border:1px solid var(--line);border-radius:8px;overflow:hidden;display:flex;flex-direction:column}}
.card.broken{{border-color:var(--warn)}}
.frame{{display:block;height:220px;overflow:hidden;position:relative;background:#fff}}
.frame iframe{{width:1280px;height:880px;border:0;transform:scale(.25);transform-origin:0 0;pointer-events:none}}
.meta{{padding:12px 14px;display:grid;gap:4px}} .meta h2{{font-size:15px;margin:0}} .meta p{{margin:0;color:var(--muted);font-size:12.5px}}
.cat{{text-transform:capitalize;color:var(--fg)}} .warn{{color:var(--warn)!important;background:var(--warn-bg);padding:4px 6px;border-radius:4px}}
.links a{{color:var(--accent)}} [hidden]{{display:none!important}}
</style></head><body>
<header>
  <h1>Template Library</h1>
  <p class="sub">{len(manifest)} processed templates · {broken} need re-processing · local preview only</p>
  <div class="controls"><input type="search" id="q" placeholder="Search templates"><button class="chip on" data-cat="">all</button>{chips}<label class="chip"><input type="checkbox" id="hb"> hide broken</label></div>
</header>
<main id="grid">{''.join(cards)}</main>
<script>
const q=document.getElementById('q'),hb=document.getElementById('hb');let cat='';
function apply(){{const s=q.value.trim().toLowerCase();document.querySelectorAll('.card').forEach(c=>{{c.hidden=(cat&&c.dataset.cat!==cat)||(s&&!c.dataset.name.includes(s))||(hb.checked&&c.classList.contains('broken'));}});}}
document.querySelectorAll('button.chip').forEach(b=>b.onclick=()=>{{cat=b.dataset.cat;document.querySelectorAll('button.chip').forEach(x=>x.classList.toggle('on',x===b));apply();}});
q.oninput=apply;hb.onchange=apply;
</script></body></html>"""
    out = os.path.join(ROOT, "gallery.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(page)
    print(f"Saved {out}: {len(manifest)} templates, {broken} flagged broken")


if __name__ == "__main__":
    build()
