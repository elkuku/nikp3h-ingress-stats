# nikp3h Ingress Stats

Static pages about the Ingress agent nikp3h, published with GitHub Pages.

## Mission Banner Finder

[`mission-banners/`](mission-banners/) lists every mission banner from the agent's mission medal
list, newest first, with the start points on a map. Each banner links to its page on
[Bannergress](https://bannergress.com) with its description, length, duration and order.

- The titles were read from the mission medals in the Ingress app.
- Each title was searched on Bannergress, and the match was checked by comparing the banner picture
  with the agent's medals.
- 8 banners are not on Bannergress; they are listed with the title from Ingress.

| File | Content |
|------|---------|
| `mission-banners/index.html` | The page |
| `mission-banners/data.js` | The banners: title, place, Bannergress id, description, length, duration, start point |
| `mission-banners/img/` | The agent's medals for each banner |
| `mission-banners/world.js` | Country outlines, shown when the map tiles can't load |
| `mission-banners/vendor/` | [Leaflet](https://leafletjs.com) 1.9.4 and [TopoJSON](https://github.com/topojson/topojson) 3.0.2 |

Map tiles: Esri World Dark Gray Canvas. Country outlines: [Natural Earth](https://www.naturalearthdata.com)
via [world-atlas](https://github.com/topojson/world-atlas). Banner data: Bannergress.

## View locally

Open `mission-banners/index.html` in a browser.

## Deploy

`.github/workflows/pages.yml` publishes the site to GitHub Pages on every push to `main`.
In the repository settings, set *Pages → Build and deployment → Source* to **GitHub Actions** once.
