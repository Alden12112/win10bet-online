const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 4180);
const ADMIN_USER = process.env.ADMIN_USER || "win10bet-admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "W10b@Admin-728419";
const ROOT = __dirname;
const ASSETS = path.join(ROOT, "assets");
const DATA_DIR = process.env.DATA_DIR || ROOT;
const STATE_FILE = path.join(DATA_DIR, "win10bet-shared-state.json");
const DAY = 24 * 60 * 60 * 1000;

const text = {
  accountRequired: "\u8bf7\u8f93\u5165\u8d26\u53f7",
  badPassword: "\u5bc6\u7801\u81f3\u5c114\u4e2a\u5b57\u6bcd\u6216\u53f7\u7801",
  duplicate: "\u8fd9\u4e2a\u8d26\u53f7\u5df2\u7ecf\u5728\u4e86",
  badLogin: "\u7528\u6237\u540d\u6216\u5bc6\u7801\u9519\u8bef",
  userMissing: "\u627e\u4e0d\u5230\u8fd9\u4e2a\u7528\u6237",
  requestMissing: "\u627e\u4e0d\u5230\u8fd9\u4e2a\u7533\u8bf7",
  betMissing: "\u627e\u4e0d\u5230\u8fd9\u5f20\u5f85\u7ed3\u7b97\u5355",
  amountRequired: "\u8bf7\u8f93\u5165\u53d1\u653e\u6570\u91cf",
  worldCup: "\u4e16\u754c\u676f",
  registerLog: "\u6ce8\u518c\u8d26\u53f7",
  register: "\u6ce8\u518c",
  manualGrant: "\u540e\u53f0\u624b\u52a8\u52a0\u79ef\u5206",
  approveGrant: "\u540e\u53f0\u53d1\u653e\u79ef\u5206",
  grant: "\u53d1\u653e",
  settleWin: "\u540e\u53f0\u7ed3\u7b97\u8d62",
  settleLose: "\u540e\u53f0\u7ed3\u7b97\u8f93",
  settleVoid: "\u540e\u53f0\u4f5c\u5e9f\u9000\u56de",
  forcedResult: "\u540e\u53f0\u4fdd\u5b58\u6d4b\u8bd5\u7ed3\u679c",
  testWin: "\u6d4b\u8bd5\u8d62",
  testLose: "\u6d4b\u8bd5\u8f93",
  random: "\u968f\u673a"
};

const defaultState = {
  users: {},
  currentUser: "",
  requests: [],
  logs: [],
  openBets: [],
  slotStats: {},
  gameTrends: {},
  testOverrides: {},
  cardSkin: "classic",
  odds: {
    sports: 50,
    blackjack: 49,
    baccarat: 48,
    niuniu: 48,
    dragon: 48,
    zhajinhua: 47,
    texas: 47,
    sangong: 48,
    showhand: 46,
    paijiu: 47,
    teenpatti: 47,
    ander: 48,
    thor: 44,
    fortune: 44,
    aztec: 44,
    "dragon-treasure": 44,
    "space-spin": 44,
    fruit: 45,
    "candy-pop": 45,
    "gold-panther": 44,
    "neon-gate": 44,
    runner: 48,
    mines: 48,
    plinko: 48,
    dice: 46,
    fish: 46,
    crashcar: 47,
    roulette: 47,
    sicbo: 46,
    penalty: 48,
    duel: 48,
    derby: 47,
    hoops: 48,
    darts: 48,
    bowling: 47,
    nineball: 47,
    boxing: 48,
    serve: 48,
    moto: 47,
    keeper: 48,
    "space-race": 47,
    "speed-baccarat": 48,
    "super-six": 47,
    redblack: 47,
    "goal-rush": 48,
    "cyber-arena": 48
  }
};

function now() {
  return new Date().toISOString();
}

function cleanState(input = {}) {
  const data = { ...defaultState, ...input };
  data.users = data.users || {};
  data.requests = data.requests || [];
  data.logs = (data.logs || []).filter(log => {
    const time = new Date(log.time || 0).getTime();
    return time && Date.now() - time <= 7 * DAY;
  });
  data.openBets = data.openBets || [];
  data.slotStats = data.slotStats || {};
  data.gameTrends = data.gameTrends || {};
  data.testOverrides = data.testOverrides || {};
  data.odds = { ...defaultState.odds, ...(data.odds || {}) };
  data.currentUser = "";
  return data;
}

function readState() {
  try {
    return cleanState(JSON.parse(fs.readFileSync(STATE_FILE, "utf8")));
  } catch {
    return cleanState(defaultState);
  }
}

function writeState(state) {
  const clean = cleanState(state);
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(clean, null, 2), "utf8");
  return clean;
}

function addLog(state, user, item, stake, result, status) {
  state.logs.unshift({ time: now(), user, item, stake, result, status });
}

function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type, authorization"
  });
  res.end(JSON.stringify(body));
}

function unauthorized(res) {
  res.writeHead(401, {
    "content-type": "text/plain; charset=utf-8",
    "www-authenticate": 'Basic realm="Win10bet Admin"',
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type, authorization"
  });
  res.end("Admin password required");
}

function isAdminRequest(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Basic ")) return false;
  try {
    const raw = Buffer.from(header.slice(6), "base64").toString("utf8");
    const index = raw.indexOf(":");
    const user = index >= 0 ? raw.slice(0, index) : "";
    const pass = index >= 0 ? raw.slice(index + 1) : "";
    return user === ADMIN_USER && pass === ADMIN_PASSWORD;
  } catch {
    return false;
  }
}

function requireAdmin(req, res) {
  if (isAdminRequest(req)) return true;
  unauthorized(res);
  return false;
}

function stateResponse(res, state) {
  return json(res, 200, { ok: true, state: writeState(state) });
}

function requireUser(state, name, res) {
  if (!name || !state.users[name]) {
    json(res, 404, { ok: false, message: text.userMissing });
    return null;
  }
  return state.users[name];
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 2_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function validPassword(pass) {
  return /^[A-Za-z0-9]{4,}$/.test(pass);
}

function ymd(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function marketProbability(seed, index, sport) {
  const home = sport === "NBA"
    ? 0.48 + ((seed + index) % 5) * 0.02
    : 0.40 + ((seed + index) % 6) * 0.035;
  if (sport === "NBA") return [Math.min(0.60, home), Math.max(0.40, 1 - home)];
  const draw = 0.24 + ((seed + index) % 3) * 0.02;
  return [Math.min(0.58, home), draw, Math.max(0.18, 1 - home - draw)];
}

function mapEspnEvent(event, sport, index) {
  const competition = event.competitions && event.competitions[0];
  const competitors = competition?.competitors || [];
  const home = competitors.find(item => item.homeAway === "home") || competitors[0];
  const away = competitors.find(item => item.homeAway === "away") || competitors[1];
  const startAt = competition?.date || event.date;
  if (!home || !away || !startAt) return null;
  const duration = sport === "NBA" ? 165 * 60 * 1000 : 130 * 60 * 1000;
  const endAt = new Date(new Date(startAt).getTime() + duration).toISOString();
  if (Date.now() >= new Date(endAt).getTime()) return null;
  const homeName = home.team?.displayName || home.team?.shortDisplayName || home.team?.name || "Home";
  const awayName = away.team?.displayName || away.team?.shortDisplayName || away.team?.name || "Away";
  return {
    id: `live-${sport.toLowerCase().replace(/\W/g, "")}-${event.id || crypto.createHash("md5").update(`${sport}-${homeName}-${awayName}-${startAt}`).digest("hex").slice(0, 10)}`,
    sport,
    league: event.league?.name || (sport === "NBA" ? "NBA Auto Board" : "FIFA World Cup Auto"),
    startAt,
    endAt,
    home: homeName,
    away: awayName,
    type: sport === "NBA" ? "nba" : "football",
    source: "ESPN scoreboard",
    probs: marketProbability(String(event.id || "").length, index, sport),
    spread: index % 2 ? "-2.5" : "-4.5",
    total: index % 2 ? "219.5" : "224.5"
  };
}

async function remoteFixtures() {
  if (typeof fetch !== "function") return [];
  const days = Array.from({ length: 5 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + index);
    return ymd(date);
  });
  const nbaUrls = days.map(date => `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${date}`);
  const wcUrls = days.map(date => `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${date}`);
  const payloads = await Promise.allSettled([...nbaUrls, ...wcUrls].map(fetchJson));
  const fixtures = [];
  payloads.forEach((result, index) => {
    if (result.status !== "fulfilled") return;
    const sport = index < nbaUrls.length ? "NBA" : text.worldCup;
    (result.value.events || []).forEach((event, eventIndex) => {
      const mapped = mapEspnEvent(event, sport, eventIndex);
      if (mapped) fixtures.push(mapped);
    });
  });
  return fixtures;
}

function fallbackFixtures() {
  const footballTeams = [
    ["Brazil", "Germany"],
    ["Argentina", "France"],
    ["Spain", "England"],
    ["Portugal", "Netherlands"],
    ["Japan", "Croatia"],
    ["Mexico", "USA"],
    ["Korea", "Uruguay"],
    ["Morocco", "Belgium"]
  ];
  const nbaTeams = [
    ["New York Knicks", "San Antonio Spurs"],
    ["Boston Celtics", "Los Angeles Lakers"],
    ["Golden State Warriors", "Miami Heat"],
    ["Denver Nuggets", "Dallas Mavericks"]
  ];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fixtures = [];
  for (let i = 0; i < 5; i += 1) {
    const base = new Date(today.getTime() + i * DAY);
    const wcStart = new Date(base);
    wcStart.setHours(i % 2 ? 22 : 3, 0, 0, 0);
    const nbaStart = new Date(base);
    nbaStart.setHours(8, 30, 0, 0);
    const wcTeams = footballTeams[i % footballTeams.length];
    const nba = nbaTeams[i % nbaTeams.length];
    fixtures.push({
      id: `auto-wc-${wcStart.toISOString().slice(0, 10)}-${i}`,
      sport: text.worldCup,
      league: "FIFA World Cup Auto",
      startAt: wcStart.toISOString(),
      endAt: new Date(wcStart.getTime() + 130 * 60 * 1000).toISOString(),
      home: wcTeams[0],
      away: wcTeams[1],
      type: "football",
      probs: [0.44 + (i % 3) * 0.04, 0.28, 0.28 - (i % 3) * 0.04]
    });
    fixtures.push({
      id: `auto-nba-${nbaStart.toISOString().slice(0, 10)}-${i}`,
      sport: "NBA",
      league: "NBA Auto Board",
      startAt: nbaStart.toISOString(),
      endAt: new Date(nbaStart.getTime() + 165 * 60 * 1000).toISOString(),
      home: nba[0],
      away: nba[1],
      type: "nba",
      probs: [0.52 - (i % 2) * 0.05, 0.48 + (i % 2) * 0.05],
      spread: i % 2 ? "-2.5" : "-4.5",
      total: i % 2 ? "219.5" : "224.5"
    });
  }
  return fixtures.filter(item => Date.now() < new Date(item.endAt).getTime());
}

async function autoFixtures() {
  try {
    const live = await remoteFixtures();
    if (live.length) return live;
  } catch {
    // Offline fallback keeps the sportsbook populated without manual work.
  }
  return fallbackFixtures();
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/win10bet.html";
  const file = pathname === "/admin.html"
    ? path.join(ROOT, "admin.html")
    : path.join(ASSETS, pathname.replace(/^\/+/, ""));
  if (pathname === "/admin.html" && !requireAdmin(req, res)) return;
  const resolved = path.resolve(file);
  const allowed = resolved.startsWith(path.resolve(ASSETS)) || resolved === path.resolve(path.join(ROOT, "admin.html"));
  if (!allowed || !fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  const ext = path.extname(resolved).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp"
  };
  res.writeHead(200, { "content-type": types[ext] || "application/octet-stream" });
  fs.createReadStream(resolved).pipe(res);
}

function routeAdmin(pathname, body, res) {
  const state = readState();
  if (pathname === "/api/admin/grant") {
    const name = String(body.user || "").trim();
    const account = requireUser(state, name, res);
    if (!account) return;
    const amount = Number(body.amount || 0);
    if (!Number.isFinite(amount) || amount < 1) return json(res, 400, { ok: false, message: text.amountRequired });
    account.balance = Number(account.balance || 0) + amount;
    addLog(state, name, text.manualGrant, 0, amount, text.grant);
    return stateResponse(res, state);
  }

  if (pathname === "/api/admin/approve-request") {
    const id = String(body.id || "");
    const reqItem = state.requests.find(item => item.id === id);
    if (!reqItem) return json(res, 404, { ok: false, message: text.requestMissing });
    const account = requireUser(state, reqItem.user, res);
    if (!account) return;
    const amount = Number(reqItem.amount || 0);
    account.balance = Number(account.balance || 0) + amount;
    state.requests = state.requests.filter(item => item.id !== id);
    addLog(state, reqItem.user, text.approveGrant, 0, amount, text.grant);
    return stateResponse(res, state);
  }

  if (pathname === "/api/admin/settle-bet") {
    const id = String(body.id || "");
    const resultType = String(body.resultType || "lose");
    const bet = state.openBets.find(item => item.id === id);
    if (!bet) return json(res, 404, { ok: false, message: text.betMissing });
    const account = requireUser(state, bet.user, res);
    if (!account) return;
    let result = 0;
    let status = text.settleLose;
    if (resultType === "win") {
      result = Number(bet.payout || 0);
      account.balance = Number(account.balance || 0) + result;
      status = text.settleWin;
    } else if (resultType === "void") {
      result = Number(bet.stake || 0);
      account.balance = Number(account.balance || 0) + result;
      status = text.settleVoid;
    }
    state.openBets = state.openBets.filter(item => item.id !== id);
    addLog(state, bet.user, `${bet.item} ${status}`, Number(bet.stake || 0), result, status);
    return stateResponse(res, state);
  }

  if (pathname === "/api/admin/forced-result") {
    const name = String(body.user || "").trim();
    const account = requireUser(state, name, res);
    if (!account) return;
    const value = String(body.value || "random");
    if (value === "random") delete state.testOverrides[name];
    else state.testOverrides[name] = value;
    const status = value === "win" ? text.testWin : value === "lose" ? text.testLose : text.random;
    addLog(state, name, text.forcedResult, 0, 0, status);
    return stateResponse(res, state);
  }

  if (pathname === "/api/admin/clear-logs") {
    state.logs = (state.logs || []).filter(log => Date.now() - new Date(log.time).getTime() <= 7 * DAY);
    return stateResponse(res, state);
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type, authorization"
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === "GET" && url.pathname === "/api/state") {
      return json(res, 200, { ok: true, state: readState() });
    }
    if (req.method === "GET" && url.pathname === "/api/health") {
      const state = readState();
      return json(res, 200, {
        ok: true,
        service: "win10bet",
        users: Object.keys(state.users || {}).length,
        requests: (state.requests || []).length,
        openBets: (state.openBets || []).length,
        time: now()
      });
    }
    if (req.method === "GET" && url.pathname === "/api/fixtures") {
      return json(res, 200, { ok: true, fixtures: await autoFixtures() });
    }
    if (req.method === "POST" && url.pathname === "/api/state") {
      const body = await readJson(req);
      return json(res, 200, { ok: true, state: writeState(body.state || body) });
    }
    if (req.method === "POST" && url.pathname === "/api/register") {
      const body = await readJson(req);
      const name = String(body.name || "").trim();
      const pass = String(body.pass || "").trim();
      if (!name) return json(res, 400, { ok: false, message: text.accountRequired });
      if (!validPassword(pass)) return json(res, 400, { ok: false, message: text.badPassword });
      const state = readState();
      if (state.users[name]) return json(res, 409, { ok: false, message: text.duplicate });
      state.users[name] = { name, pass, balance: 0, createdAt: now() };
      addLog(state, name, text.registerLog, 0, 0, text.register);
      return json(res, 200, { ok: true, currentUser: name, state: writeState(state) });
    }
    if (req.method === "POST" && url.pathname === "/api/login") {
      const body = await readJson(req);
      const name = String(body.name || "").trim();
      const pass = String(body.pass || "").trim();
      const state = readState();
      if (!state.users[name] || state.users[name].pass !== pass) {
        return json(res, 401, { ok: false, message: text.badLogin });
      }
      return json(res, 200, { ok: true, currentUser: name, state });
    }
    if (req.method === "POST" && url.pathname.startsWith("/api/admin/")) {
      if (!requireAdmin(req, res)) return;
      const routed = routeAdmin(url.pathname, await readJson(req), res);
      if (routed !== false) return routed;
    }
    serveStatic(req, res);
  } catch (error) {
    json(res, 500, { ok: false, message: error.message });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  writeState(readState());
  console.log(`Win10bet shared server: http://127.0.0.1:${PORT}/win10bet.html`);
  console.log(`Win10bet admin: http://127.0.0.1:${PORT}/admin.html`);
});
