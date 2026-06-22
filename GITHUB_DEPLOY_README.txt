WIN10BET GITHUB + ONLINE SERVER DEPLOY

Important:
GitHub Pages alone is static hosting. It cannot run the Node API server and
cannot save central user registration data by itself. For central admin and
shared user data, you must run outputs/win10bet-server.js on an online Node server.

What GitHub is for:
1. Upload this whole folder to a GitHub repository.
2. Connect the GitHub repository to a Node hosting service.
3. The hosting service runs npm start.

You can also use GitHub Pages for the front end only:
1. Publish the docs folder with GitHub Pages.
2. Keep the Node server online on Render/Railway/Fly/VPS.
3. Edit docs/win10bet-config.js and set:
   apiBase: "https://YOUR-DOMAIN"
4. Then GitHub Pages will still use your online API for users, bets, admin data,
   and auto-updated fixtures.

Good hosting choices:
- Render
- Railway
- Fly.io
- VPS with Node.js

Render quick deploy:
1. Push this whole project to GitHub.
2. Go to Render and create a new Web Service from the GitHub repo.
3. Render can read render.yaml automatically.
4. Build command: npm install
5. Start command: npm start
6. DATA_DIR should be /var/data.
7. Keep the persistent disk enabled. This stores users, points, logs, and bets.

URLs after deploy:
Front:
https://YOUR-DOMAIN/win10bet.html

Admin:
https://YOUR-DOMAIN/admin.html

GitHub Pages front example:
https://YOUR-NAME.github.io/YOUR-REPO/win10bet.html

GitHub Pages admin example:
https://YOUR-NAME.github.io/YOUR-REPO/admin.html?api=https://YOUR-DOMAIN

Health check:
https://YOUR-DOMAIN/api/health

Admin login:
ADMIN_USER and ADMIN_PASSWORD are set in the hosting service environment.
If Render generated the password, open Render dashboard and copy it from
Environment Variables.

Do not use only GitHub Pages:
If you only upload win10bet.html to GitHub Pages, every visitor will have
separate browser data and your admin will not receive all registrations.

Central admin rule:
All users must use the same deployed server URL. Then every registration,
login, point request, bet, pending ticket, and log goes to your admin.

Sports automation:
/api/fixtures provides World Cup and NBA matches for the next 5 days.
Finished matches are removed automatically.
If internet fetch fails, the server uses fallback matches so the page is not empty.
