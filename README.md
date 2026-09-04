# Skid Tracker

A mobile-first web app for lumpers. Enter a tally sheet, see exactly how many skids each line needs, and tap them off one by one as you build. Progress is saved on the phone, so it survives a locked screen, a closed browser, or a reload. Works offline after the first load.

Plain HTML, CSS, and JavaScript. No build step, no frameworks, nothing to install.

## Files

| File | Purpose |
|------|---------|
| `index.html` | App shell |
| `style.css` | Styles (light and dark mode) |
| `app.js` | All logic, state in `localStorage` under the key `skidTracker` |
| `manifest.json` | Lets the app be added to the home screen and open full-screen |
| `sw.js` | Service worker that caches the app for offline use |
| `icon.svg`, `icon-*.png` | App icons |

## Deploy on GitHub Pages (two clicks)

1. Push this repository to GitHub with the files at the root of the `main` branch.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Set the branch to **main** and the folder to **/ (root)**, then click **Save**.

After a minute the site is live at `https://<your-username>.github.io/<repo-name>/`.

## Add to the home screen

- **iPhone (Safari):** open the site, tap the Share button, then **Add to Home Screen**.
- **Android (Chrome):** open the site, tap the three-dot menu, then **Add to Home screen** or **Install app**.

The app then opens full-screen like a native app and keeps working without a signal.

## The math

For each line on the tally sheet:

```
casesPerSkid = tie × tier
fullSkids    = floor(cases / casesPerSkid)
remainder    = cases % casesPerSkid
totalSkids   = fullSkids + (remainder > 0 ? 1 : 0)
```

Every skid gets its own checkbox. Full skids show the full case count. If there is a remainder, the last skid is a partial and shows its case count.

## Local testing

Open `index.html` directly in a browser, or serve the folder:

```
python3 -m http.server 8000
```

Then visit `http://localhost:8000`. The service worker only registers over `http` or `https`, so offline caching is not active when opening the file directly.

## Data

Everything lives in the browser's `localStorage` under `skidTracker`. Use **Export JSON** on the home screen to back up loads, and **Import JSON** to restore them on another phone.
