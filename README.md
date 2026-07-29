# GlobeTap Unlimited

A zero-backend geography guessing prototype built for GitHub Pages.

## What it does

- Interactive textured 3D Earth (Three.js)
- Drag to orbit and wheel/pinch to zoom
- Click the globe to place a guess
- Converts the 3D hit point to latitude/longitude
- Haversine great-circle distance scoring
- Guess + answer markers and great-circle result arc
- Unlimited random rounds using `data/locations.csv`
- Continent and difficulty filters
- Running round / total / average score
- Responsive desktop/mobile UI

## Run locally

Because the page loads a CSV with `fetch()`, do **not** double-click `index.html` and run it as `file://`.

From this folder:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Put it on GitHub Pages

1. Put these files in a GitHub repository.
2. Commit and push.
3. In **Settings → Pages**, publish from your main branch (root folder).
4. Open the generated GitHub Pages URL.

There is no build step and no backend.

## Files

```text
index.html
styles.css
game.js
data/
  locations.csv
```

## Earth texture

The prototype currently loads the Three.js example Earth texture from:

`https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg`

For a fully self-contained site, download a suitably licensed equirectangular Earth texture, save it as `assets/earth.jpg`, and change `EARTH_TEXTURE` near the top of `game.js` to:

```js
const EARTH_TEXTURE = './assets/earth.jpg';
```

NASA's Blue Marble imagery is a good source for a local texture.

## Scoring

The scoring curve is intentionally simple and lives in one function:

```js
function scoreFromDistance(distanceKm) {
  return Math.max(0, Math.round(5000 * Math.exp(-distanceKm / 2500)));
}
```

Change the `2500` constant to make scoring more or less forgiving.

## Next obvious upgrades

- Seeded challenge URLs so every friend gets the same sequence
- Timed mode
- Country/province polygons from GeoJSON
- Click-within-polygon scoring for country/state modes
- Round history / final score screen
- Sound and animation polish
- Optional Firebase/Supabase multiplayer leaderboard
