#!/usr/bin/env bash
# One-off: pull the published Webflow pages (with CMS content) and every
# remote asset they reference into _mirror/ so the static build can be self-hosted.
set -euo pipefail
OUT=_mirror
rm -rf "$OUT"; mkdir -p "$OUT/assets"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/130 Safari/537.36"

curl -fsSL -A "$UA" https://popsylovesyou.webflow.io/ -o "$OUT/index.html"
curl -fsSL -A "$UA" https://popsylovesyou.webflow.io/family -o "$OUT/family.html"

cat "$OUT/index.html" "$OUT/family.html" index.html family.html \
  | grep -oE 'https://(cdn\.prod\.website-files\.com|d3e54v103j8qbb\.cloudfront\.net|unpkg\.com|cdn\.tailwindcss\.com)[^"'"'"' )<>`,]*' \
  | sed 's/&amp;/\&/g' | sort -u > "$OUT/urls.txt"

echo "Found $(wc -l < "$OUT/urls.txt") urls"
: > "$OUT/manifest.tsv"
while read -r url; do
  path=$(echo "$url" | sed -E 's#^https://##; s#\?.*$##')
  # bare host / directory urls (preconnect hints) are skipped
  case "$path" in */) continue;; esac
  [[ "$path" == */* ]] || continue
  dest="$OUT/assets/$path"
  mkdir -p "$(dirname "$dest")"
  if curl -fsSL -A "$UA" --retry 3 "$url" -o "$dest"; then
    printf '%s\t%s\n' "$url" "$path" >> "$OUT/manifest.tsv"
  else
    echo "FAILED $url"
    rm -f "$dest"
  fi
done < "$OUT/urls.txt"
du -sh "$OUT"
