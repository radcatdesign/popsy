"""Splice live Webflow CMS lists into the static export and point remote assets at local copies.

Usage: python3 scripts/splice.py <mirror_dir>
Reads <mirror_dir>/{index,family}.html and manifest.tsv, rewrites ./index.html and ./family.html,
and copies mirrored assets into ./assets/.
"""
import re, sys, shutil, pathlib

MIRROR = pathlib.Path(sys.argv[1])
ROOT = pathlib.Path('.')


def top_level_lists(html):
    """Return (start, end) spans of top-level <div ... class="...w-dyn-list..."> blocks."""
    spans = []
    tag_re = re.compile(r'<(/?)div\b[^>]*>', re.I)
    i = 0
    while True:
        m = re.search(r'<div\b[^>]*class="[^"]*\bw-dyn-list\b[^"]*"[^>]*>', html[i:])
        if not m:
            break
        start = i + m.start()
        depth = 0
        for t in tag_re.finditer(html, start):
            depth += -1 if t.group(1) else 1
            if depth == 0:
                end = t.end()
                break
        spans.append((start, end))
        i = end
    return spans


def splice(name):
    exp = (ROOT / name).read_text()
    live = (MIRROR / name).read_text()
    es, ls = top_level_lists(exp), top_level_lists(live)
    if len(es) != len(ls):
        raise SystemExit(f'{name}: export has {len(es)} lists, live has {len(ls)}')
    out, pos = [], 0
    for (a, b), (c, d) in zip(es, ls):
        out.append(exp[pos:a])
        out.append(live[c:d])
        pos = b
    out.append(exp[pos:])
    return ''.join(out)


manifest = {}
for line in (MIRROR / 'manifest.tsv').read_text().splitlines():
    url, path = line.split('\t')
    manifest[url] = path

for name in ('index.html', 'family.html'):
    html = splice(name)
    # longest first so a URL never clobbers a longer one sharing its prefix
    for url in sorted(manifest, key=len, reverse=True):
        local = 'assets/' + manifest[url]
        html = html.replace(url, local).replace(url.replace('&', '&amp;'), local)
    (ROOT / name).write_text(html)
    left = sorted(set(re.findall(r'https://(?:cdn\.prod\.website-files\.com|d3e54v103j8qbb\.cloudfront\.net)[^"\'\s)<>`]*', html)))
    print(name, 'remaining remote refs:', left)

# Merge the mirrored files into assets/ (add / update only). Never clear the folder: it also
# holds everything made by hand (hover and intro videos, the eye, thumbnails, WebP copies).
src = MIRROR / 'assets'
dst = ROOT / 'assets'
shutil.copytree(src, dst, dirs_exist_ok=True)
print('assets merged')

# Photos are served as WebP (a fraction of the PNG / JPEG size, white backgrounds intact).
# Convert any new PNG / JPEG the pages now point at and switch the references over.
from PIL import Image
for name in ('index.html', 'family.html'):
    html = (ROOT / name).read_text()
    for ref in sorted(set(re.findall(r'assets/[^"\'\s)<>`]+?\.(?:png|jpe?g)', html, re.I))):
        path = ROOT / ref
        if not path.exists():
            continue
        webp = path.with_suffix('.webp')
        if not webp.exists():
            im = Image.open(path)
            if im.mode not in ('RGB', 'RGBA'):
                im = im.convert('RGBA' if 'A' in im.mode or 'transparency' in im.info else 'RGB')
            if im.width > 1200:
                im = im.resize((1200, round(im.height * 1200 / im.width)), Image.LANCZOS)
            im.save(webp, 'WEBP', quality=82, method=6)
        html = html.replace(ref, ref[: -len(path.suffix)] + '.webp')
    (ROOT / name).write_text(html)
print('photos switched to WebP')
