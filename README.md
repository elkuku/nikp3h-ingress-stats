# nikp3h Ingress Stats

Static pages about the Ingress agent nikp3h, published with GitHub Pages:
<https://elkuku.github.io/nikp3h-ingress-stats/mission-banners/>

## Mission Banner Finder

[`mission-banners/`](mission-banners/) lists every mission banner from the agent's mission medal
list, newest first: the screenshot of the medals in Ingress, the start points on a map and a table
with each banner's Bannergress page, description, length, duration and order, and whether it is on
the agent's Bannergress done list. Selecting a banner in the screenshot, on the map or in the
table shows it in the other two.

- The titles were read from the mission medals in the Ingress app.
- Each title was searched on Bannergress, and the match was checked by comparing the banner picture
  with the agent's medals.
- 5 banners are not on Bannergress; they are listed with the title from Ingress.

| File | Content |
|------|---------|
| `mission-banners/index.html` | The page: the mission medal screenshot beside a map of the start points and a table of every banner (medals, Bannergress match, done list, analysis) |
| `mission-banners/data.js` | The banners: title, place, Bannergress id, description, length, duration, start point |
| `mission-banners/img/` | The agent's medals for each banner |
| `mission-banners/favicon.ico`, `apple-touch-icon.png` | The page icon, made from the onyx SpecOps medal |
| `mission-banners/preview.jpg` | The link preview image (Telegram, WhatsApp, …), drawn by `tools/update_missions.py` on every run; it also writes the description and image link of the preview tags in `mission-banners/index.html` and in the home page `index.html` (which forwards to the banners page) |
| `mission-banners/medals/` | The Ingress SpecOps medals (from AgentTools); the header shows the one the mission count has reached |
| `mission-banners/missions.html` | Redirects to the page (it was a page of its own) |
| `mission-banners/missions-data.js` | Its data, written by `tools/update_missions.py`: the screenshot tiles, the position of each medal row, the Bannergress done list (from AgentTools), the notes |
| `mission-banners/shot/` | The screenshot (`ingress-missions.png`, not in the repo) as half-size JPEG tiles |
| `mission-banners/world.js` | Country outlines, shown when the map tiles can't load |
| `mission-banners/vendor/` | [Leaflet](https://leafletjs.com) 1.9.4 and [TopoJSON](https://github.com/topojson/topojson) 3.0.2 |

Map tiles: Esri World Dark Gray Canvas. Country outlines: [Natural Earth](https://www.naturalearthdata.com)
via [world-atlas](https://github.com/topojson/world-atlas). Banner data: Bannergress.

## Update the missions page

Needs Python 3 with [Pillow](https://python-pillow.org) (`pip install pillow`).

```sh
python3 tools/update_missions.py --done done-banners.json   # a new done list
python3 tools/update_missions.py --screenshot ingress-missions.png   # a new screenshot
python3 tools/update_missions.py   # only the notes changed
```

- **Done list** (after a Bannergress sync in the AgentTools app): the done banners as JSON, as
  AgentTools' `GET /api/done-banners` returns them (`bannerId`, `title`, `missions`,
  `startLatitude`, `startLongitude`, `doneAt`, newest first). `--synced-at` sets the sync time
  shown on the page (default: now).
- **Screenshot** (`ingress-missions.png`, 1080 px wide, not in the repo): cut into tiles in
  `mission-banners/shot/`; the script finds the medal rows and checks them against the medal
  pictures in `mission-banners/img/`. When new medals were added at the top, it stops and says how
  many rows are new: their banners have to be added to `data.js` (title, Bannergress match, medal
  picture) and the rows of the others moved first.
- **Notes** (`tools/notes.json`): a note per banner, shown in the Analysis column. The key is the
  Bannergress id, or `medal:<name in Ingress>` for medals without a Bannergress match. The script
  says when a note matches no banner any more.

## View locally

Open `mission-banners/index.html` in a browser.

## Deploy

`.github/workflows/pages.yml` publishes the site to GitHub Pages on every push to `main`.
In the repository settings, set *Pages → Build and deployment → Source* to **GitHub Actions** once.
