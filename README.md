# Popsy Loves You

Ceramics and stories by Brandon Kaufer. Static site, exported from Webflow and deployed on Vercel.

- `index.html`: the draggable "Everything" grid
- `family.html`: the Family Tree (React Flow, served at `/family`)
- `assets/`: every image and vendor script, self-hosted (nothing loads from Webflow's CDN)
- `css/tailwind.css`: compiled Tailwind for the family page

## Updating content

Pieces are still managed in the Webflow CMS. After publishing changes in Webflow, run
**Actions > Sync from Webflow > Run workflow** on GitHub. It pulls the published CMS content and
images into this repo and commits to `main`, which redeploys on Vercel.

Hover videos live in `assets/hover/` and pair with pieces by image filename (`M_F-01` plays `M_A-01.webm`, `M_FP-09` plays `M_AP-09.webm`, `M_FC-14` plays `M_AC-14.webm`). To add one, drop the `.webm` in that folder and add its name to `HOVER_VIDEOS` in `index.html`.
