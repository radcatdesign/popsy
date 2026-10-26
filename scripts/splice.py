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

src = MIRROR / 'assets'
dst = ROOT / 'assets'
if dst.exists():
    shutil.rmtree(dst)
shutil.copytree(src, dst)
print('assets copied')
