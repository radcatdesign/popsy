# Popsy Loves You

Ceramics and stories by Brandon Kaufer. Static site, exported from Webflow and deployed on Vercel.

- `index.html`: the draggable "Everything" grid
- `family.html`: the Family Tree (React Flow, served at `/family`)
- `assets/`: every image, video and vendor script, self-hosted (nothing loads from Webflow's CDN)
- `css/tailwind.css`: compiled Tailwind for the family page

## Updating content

Pieces are still managed in the Webflow CMS. After publishing changes in Webflow, run
**Actions > Sync from Webflow > Run workflow** on GitHub. It pulls the published CMS content and
images into this repo and commits to `main`, which redeploys on Vercel.

Newer pieces pair through `NAMED_HOVERS` in `index.html`, keyed by the end of the photo's file
name (`20-Big` plays `tessik.webm`; the October 2026 batch is `N-Big` to `piece-N`), so a video
starts working as soon as a CMS item uses that photo.

Hover videos live in `assets/hover/` and pair with pieces by image filename (`M_F-01` plays `M_A-01.webm`, `M_FP-09` plays `M_AP-09.webm`, `M_FC-14` plays `M_AC-14.webm`). To add one, drop the `.webm` in that folder and add its name to `HOVER_VIDEOS` in `index.html`.

## Performance notes

- **Photos** are WebP (PNG / JPEG originals converted at 1200px, white backgrounds intact) or the
  AVIF Webflow already serves. The sync workflow converts any new PNG / JPEG it pulls in.
- **Font**: `fonts/UglyDave.woff2` (WOFF2 of the original OTF, every glyph kept), preloaded.
- **Monster videos**: VP9 WebM for most browsers; Safari gets H.264 MP4. (Not HEVC: iPhone draws
  it on its own video layer, which ignores the multiply blend and the big tiles' sizing.) Desktop
  and tablet get a 960px cut (`name-hd.*`) for the pieces that have one.
- **Loading**: the grid builds out once the logo film has played and the photos and videos of the
  pieces on the first screen are in memory; everything else downloads behind it, nearest first.
  Off-screen photos load as they come near.
- **Family tree**: `src/family-tree.jsx` is precompiled to `js/family-tree.js`
  (`scripts/build-family.sh`); no in-browser Babel.
- No jQuery or Webflow runtime: nothing on the site uses them.
