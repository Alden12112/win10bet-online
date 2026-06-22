WIN10BET DEPLOY README

Best final result:
1. Upload this whole folder to GitHub
2. Deploy the repo to Render
3. Use Render as the real shared backend
4. Optionally publish /docs to GitHub Pages for a static front mirror

Important:
GitHub Pages alone cannot run the shared backend.
If you want all devices to share one admin, one user database, and auto-updating fixtures,
you must run win10bet-server.js on Render, Railway, Fly.io, or a VPS.

Real production URLs:
Front:
https://YOUR-RENDER-DOMAIN/win10bet.html

Admin:
https://YOUR-RENDER-DOMAIN/admin.html

Render settings:
Build command:
npm install

Start command:
npm start

Environment variables:
ADMIN_USER=win10bet-admin
ADMIN_PASSWORD=your-password
DATA_DIR=/var/data

Also enable persistent disk on:
/var/data

Why the disk matters:
It stores users, points, requests, logs, and open bets.

If you want GitHub Pages too:
1. Publish the docs folder
2. Edit docs/win10bet-config.js
3. Set:
apiBase: "https://YOUR-RENDER-DOMAIN"

Then GitHub Pages front will still use the online Render backend.

Local test:
1. Run start-win10bet-server.bat
2. Front: http://127.0.0.1:4180/win10bet.html
3. Admin: http://127.0.0.1:4180/admin.html

Auto sports:
/api/fixtures provides World Cup and NBA style matches for the next 5 days.
Finished matches are removed automatically.
