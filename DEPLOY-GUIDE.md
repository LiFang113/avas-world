# 🌸 Ava's World — GitHub Pages Deployment Guide

## What You'll Get
- App hosted at `https://YOUR_USERNAME.github.io/avas-world/`
- Installable on iPad home screen (looks like a real app)
- Auto-updates when you push code changes — no reinstall needed

---

## Prerequisites
- A GitHub account (you have this ✅)
- A computer with Git installed
  - Mac: open Terminal, type `git --version` (installs automatically if needed)
  - Windows: download from https://git-scm.com/downloads

---

## Step 1: Create the GitHub Repository

1. Go to **https://github.com/new**
2. Fill in:
   - Repository name: **`avas-world`**
   - Description: `Ava's learning app`
   - Set to **Public** (required for free GitHub Pages)
   - ✅ Check "Add a README file"
3. Click **Create repository**

---

## Step 2: Clone and Set Up the Project

Open Terminal (Mac) or Git Bash (Windows) and run these commands one by one:

```bash
# 1. Clone your new repo (replace YOUR_USERNAME with your GitHub username)
git clone https://github.com/YOUR_USERNAME/avas-world.git

# 2. Go into the project folder
cd avas-world

# 3. Install Node.js if you don't have it
#    Check first: node --version
#    If not installed, download from https://nodejs.org (LTS version)

# 4. Create the project
npm create vite@latest . -- --template react
#    When asked "Current directory is not empty", choose: Remove existing files and continue
#    When asked "Select a framework", choose: React
#    When asked "Select a variant", choose: JavaScript

# 5. Install dependencies
npm install
```

---

## Step 3: Add the Project Files

Now replace/add files. I've provided all 6 files you need below.

### File 1: `vite.config.js` (replace the existing one)
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/avas-world/',
})
```

### File 2: `src/App.jsx` (replace the existing one)
Copy the ENTIRE contents of `avas-world-v5.jsx` into this file. That's it — just paste the whole thing.

### File 3: `src/main.jsx` (replace the existing one)
```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/avas-world/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

### File 4: `index.html` (replace the existing one)
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Ava's World" />
    <meta name="theme-color" content="#7C3AED" />
    <link rel="manifest" href="/avas-world/manifest.json" />
    <link rel="apple-touch-icon" href="/avas-world/icon-192.png" />
    <title>Ava's World 🌸</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
      body { background: #7C3AED; overscroll-behavior: none; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

### File 5: `public/manifest.json` (create new)
```json
{
  "name": "Ava's World",
  "short_name": "Ava's World",
  "description": "Ava's learning companion",
  "start_url": "/avas-world/",
  "display": "standalone",
  "background_color": "#7C3AED",
  "theme_color": "#7C3AED",
  "orientation": "portrait",
  "icons": [
    { "src": "/avas-world/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/avas-world/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### File 6: `public/sw.js` (create new — this is the service worker for auto-updates)
```javascript
const CACHE_NAME = 'avas-world-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
```

### App Icons

You need two icon files in the `public/` folder:
- `icon-192.png` (192×192 pixels)
- `icon-512.png` (512×512 pixels)

Quick option: Use an emoji-to-image site like https://emoji.aranja.com/ — search for 🌸, download at both sizes, and put them in `public/`.

---

## Step 4: Set Up GitHub Actions (Auto-Deploy)

Create the file `.github/workflows/deploy.yml`:

```bash
# Create the folder structure
mkdir -p .github/workflows
```

Then create `.github/workflows/deploy.yml` with this content:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: ['main']

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

---

## Step 5: Enable GitHub Pages

1. Go to your repo on GitHub: `https://github.com/YOUR_USERNAME/avas-world`
2. Click **Settings** (top menu)
3. Click **Pages** (left sidebar)
4. Under "Build and deployment" → Source: select **GitHub Actions**

---

## Step 6: Push Everything and Deploy

```bash
# Delete files you don't need
rm -f src/App.css src/index.css src/assets/react.svg

# Stage all files
git add -A

# Commit
git commit -m "Initial Ava's World app"

# Push to GitHub
git push origin main
```

Now go to your repo on GitHub → **Actions** tab. You'll see the build running. Wait 1-2 minutes until it shows a green checkmark ✅.

Your app is now live at: **`https://YOUR_USERNAME.github.io/avas-world/`**

---

## Step 7: Install on iPad

1. Open **Safari** on the iPad (must be Safari, not Chrome)
2. Go to `https://YOUR_USERNAME.github.io/avas-world/`
3. Tap the **Share button** (square with arrow, bottom of screen)
4. Scroll down and tap **"Add to Home Screen"**
5. Name it "Ava's World" and tap **Add**

Done! The app icon appears on the home screen and opens full-screen like a real app.

---

## How to Update the App Later

When you fix bugs or add features:

```bash
# 1. Edit src/App.jsx with your changes

# 2. Test locally first
npm run dev
# Opens at http://localhost:5173/avas-world/ — check in your browser

# 3. When happy, push to GitHub
git add -A
git commit -m "Fix: describe what you changed"
git push origin main
```

GitHub automatically rebuilds and deploys within 1-2 minutes. Next time Ava opens the app, she gets the new version. **No reinstall needed.**

---

## Quick Reference: Project Structure

```
avas-world/
├── .github/
│   └── workflows/
│       └── deploy.yml          ← Auto-deploy config
├── public/
│   ├── manifest.json           ← PWA config
│   ├── sw.js                   ← Service worker (offline + updates)
│   ├── icon-192.png            ← App icon (small)
│   └── icon-512.png            ← App icon (large)
├── src/
│   ├── App.jsx                 ← Your main app (paste avas-world-v5.jsx here)
│   └── main.jsx                ← React entry point
├── index.html                  ← HTML shell
├── vite.config.js              ← Build config
└── package.json                ← Dependencies
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Page shows 404 | Check Settings → Pages → Source is "GitHub Actions" |
| Build fails | Go to Actions tab, click the failed run, read the error log |
| App not installable | Make sure you're using Safari, not Chrome |
| Old version showing | Close the app completely, reopen. Or clear Safari cache |
| `npm create vite` fails | Make sure Node.js is installed: `node --version` |

---

## Data Storage Note

The app currently uses `window.storage` which works in the Claude artifact. For the GitHub Pages version, you'll want to switch to `localStorage`. This is a one-line change in the save/load effects — just replace `window.storage.get/set` with `localStorage.getItem/setItem`. Let me know when you're ready for that step and I'll make the change.
