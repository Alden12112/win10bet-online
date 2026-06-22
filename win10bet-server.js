const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 4180);
const ADMIN_USER = process.env.ADMIN_USER || "win10bet-admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "W10b@Admin-728419";
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID || "";
const ROOT = __dirname;
const ASSETS = path.join(ROOT, "assets");
const DATA_DIR = process.env.DATA_DIR || ROOT;
const STATE_FILE = path.join(DATA_DIR, "win10bet-shared-state.json");
const DAY = 24 * 60 * 60 * 1000;

const text = {
  accountRequired: "\u8bf7\u8f93\u5165\u624b\u673a\u53f7",
  emailRequired: "\u8bf7\u8f93\u5165\u90ae\u7bb1",
  badEmail: "\u8bf7\u8f93\u5165\u6b63\u786e\u90ae\u7bb1",
  badPassword: "\u5bc6\u7801\u81f3\u5c116\u4f4d\u5b57\u7b26",
  duplicate: "\u8fd9\u4e2a\u624b\u673a\u53f7\u5df2\u7ecf\u6ce8\u518c",
  badLogin: "\u624b\u673a\u53f7\u6216\u5bc6\u7801\u9519\u8bef",
  badPhone: "\u8bf7\u8f93\u5165\u6b63\u786e\u624b\u673a\u53f7",
  captchaRequired: "\u8bf7\u5b8c\u6210\u4eba\u673a\u9a8c\u8bc1",
  captchaWrong: "\u4eba\u673a\u9a8c\u8bc1\u9519\u8bef",
  emailMismatch: "\u624b\u673a\u53f7\u4e0e\u90ae\u7bb1\u4e0d\u5339\u914d",
  resetPasswordLog: "\u90ae\u7bb1\u627e\u56de\u5bc6\u7801",
  resetPassword: "\u627e\u56de\u5bc6\u7801",
  codeRequired: "\u8bf7\u8f93\u5165 WhatsApp \u9a8c\u8bc1\u7801",
  whatsappUnavailable: "WhatsApp \u9a8c\u8bc1\u672a\u914d\u7f6e",
  whatsappSendFailed: "WhatsApp \u53d1\u9001\u5931\u8d25",
  whatsappCodeWrong: "WhatsApp \u9a8c\u8bc1\u7801\u9519\u8bef\u6216\u5df2\u8fc7\u671f",
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
  data.users = normalizeUserMap(data.users || {});
  data.requests = remapUserEntries(data.requests || []);
  data.logs = (data.logs || []).filter(log => {
    const time = new Date(log.time || 0).getTime();
    return time && Date.now() - time <= 7 * DAY;
  }).map(log => {
    const user = normalizeUserKey(log.user);
    return user ? { ...log, user } : log;
  });
  data.openBets = remapUserEntries(data.openBets || []);
  data.slotStats = remapUserLookupMap(data.slotStats || {});
  data.gameTrends = data.gameTrends || {};
  data.testOverrides = remapUserLookupMap(data.testOverrides || {});
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
  const key = normalizeUserKey(name);
  if (!key || !state.users[key]) {
    json(res, 404, { ok: false, message: text.userMissing });
    return null;
  }
  return state.users[key];
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
  return String(pass || "").trim().length >= 6;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function normalizePhone(phone) {
  const cleaned = String(phone || "").replace(/\D/g, "");
  if (/^60\d{9,10}$/.test(cleaned)) return cleaned;
  if (/^0?1\d{8,9}$/.test(cleaned)) return `60${cleaned.replace(/^0/, "")}`;
  return "";
}

function validPhone(phone) {
  return Boolean(normalizePhone(phone));
}

function normalizeUserKey(value) {
  return normalizePhone(value) || String(value || "").trim();
}

function normalizeUserMap(users = {}) {
  const next = {};
  for (const [key, entry] of Object.entries(users || {})) {
    const normalizedKey = normalizeUserKey(entry?.phone || entry?.name || key);
    if (!normalizedKey) continue;
    next[normalizedKey] = {
      ...entry,
      name: normalizedKey,
      phone: normalizePhone(entry?.phone || entry?.name || key) || normalizedKey,
      email: normalizeEmail(entry?.email || "")
    };
  }
  return next;
}

function remapUserEntries(list = []) {
  return list.map(item => {
    const user = normalizeUserKey(item?.user);
    return user ? { ...item, user } : item;
  });
}

function remapUserLookupMap(map = {}) {
  const next = {};
  for (const [key, value] of Object.entries(map || {})) {
    const normalizedKey = normalizeUserKey(key);
    if (!normalizedKey) continue;
    next[normalizedKey] = value;
  }
  return next;
}

function validCaptcha(question, answer) {
  const q = String(question || "").trim();
  const a = String(answer || "").trim().toLowerCase();
  const pairs = {
    "选择下面不是水果的那个词": "篮球",
    "选择一种交通工具": "火车",
    "哪一个是颜色": "蓝色",
    "哪一个可以在天上飞": "飞机",
    "哪一个属于动物": "老虎",
    "哪一个通常在厨房里": "冰箱"
  };
  return pairs[q] ? a === pairs[q].toLowerCase() : false;
}

function hasWhatsappVerify() {
  return Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_VERIFY_SERVICE_SID);
}

function formatPhoneE164(phone) {
  const normalized = normalizePhone(phone);
  return normalized ? `+${normalized}` : "";
}

async function twilioVerifyRequest(pathname, payload) {
  const response = await fetch(`https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}${pathname}`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams(payload).toString()
  });
  const textBody = await response.text();
  let data = {};
  try {
    data = textBody ? JSON.parse(textBody) : {};
  } catch {
    data = { message: textBody };
  }
  if (!response.ok) {
    throw new Error(data.message || `Twilio verify HTTP ${response.status}`);
  }
  return data;
}

async function requestWhatsappCode(phone) {
  if (!hasWhatsappVerify()) throw new Error(text.whatsappUnavailable);
  const to = formatPhoneE164(phone);
  if (!to) throw new Error(text.badPhone);
  return twilioVerifyRequest("/Verifications", { To: to, Channel: "whatsapp" });
}

async function verifyWhatsappCode(phone, code) {
  if (!hasWhatsappVerify()) throw new Error(text.whatsappUnavailable);
  const to = formatPhoneE164(phone);
  if (!to) throw new Error(text.badPhone);
  const data = await twilioVerifyRequest("/VerificationCheck", { To: to, Code: code });
  return String(data.status || "").toLowerCase() === "approved";
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const cleaned = String(value).replace(/[^\d.+-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function americanToDecimal(value) {
  const odds = parseNumber(value);
  if (!Number.isFinite(odds) || odds === 0) return null;
  return odds > 0 ? 1 + (odds / 100) : 1 + (100 / Math.abs(odds));
}

function decimalToProbability(decimal) {
  if (!Number.isFinite(decimal) || decimal <= 1) return null;
  return 1 / decimal;
}

function normalizeProbabilities(values, fallback) {
  const valid = values.map(item => Number(item)).filter(item => Number.isFinite(item) && item > 0);
  if (!valid.length) return fallback;
  const total = valid.reduce((sum, item) => sum + item, 0);
  const normalized = values.map(item => {
    if (!Number.isFinite(item) || item <= 0) return null;
    return item / total;
  });
  if (normalized.every(item => Number.isFinite(item))) return normalized;
  return fallback;
}

function makePrice(probability, margin = 0.93) {
  return round(Math.max(1.05, margin / clamp(probability || 0.01, 0.01, 0.92)));
}

function createMarket(label, odd, chance, group = "main") {
  const decimal = Number(odd);
  if (!Number.isFinite(decimal) || decimal < 1.01) return null;
  return {
    label,
    odd: round(decimal),
    chance: round(clamp(Number(chance || 0.01), 0.01, 0.92), 3),
    group
  };
}

function pairProbabilities(first, second, fallbackFirst = 0.5) {
  const fallback = [fallbackFirst, 1 - fallbackFirst];
  return normalizeProbabilities([first, second], fallback);
}

function formatLine(value, positivePrefix = "+") {
  const line = parseNumber(value);
  if (!Number.isFinite(line)) return null;
  if (line > 0) return `${positivePrefix}${round(line, 1)}`;
  if (line < 0) return `${round(line, 1)}`;
  return "0";
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
}

function moneylineProbabilities(odds, fallback) {
  const homeProb = decimalToProbability(americanToDecimal(firstDefined(
    odds?.moneyline?.home?.close?.odds,
    odds?.moneyline?.home?.open?.odds
  )));
  const drawProb = decimalToProbability(americanToDecimal(firstDefined(
    odds?.moneyline?.draw?.close?.odds,
    odds?.moneyline?.draw?.open?.odds,
    odds?.drawOdds?.moneyLine
  )));
  const awayProb = decimalToProbability(americanToDecimal(firstDefined(
    odds?.moneyline?.away?.close?.odds,
    odds?.moneyline?.away?.open?.odds
  )));
  return normalizeProbabilities([homeProb, drawProb, awayProb], fallback);
}

function footballMarketsFromData(data) {
  const fallback = data.probs || [0.46, 0.28, 0.26];
  const probs = moneylineProbabilities(data.odds, fallback);
  const homeOdd = americanToDecimal(firstDefined(data.odds?.moneyline?.home?.close?.odds, data.odds?.moneyline?.home?.open?.odds)) || makePrice(probs[0]);
  const drawOdd = americanToDecimal(firstDefined(data.odds?.moneyline?.draw?.close?.odds, data.odds?.moneyline?.draw?.open?.odds, data.odds?.drawOdds?.moneyLine)) || makePrice(probs[1]);
  const awayOdd = americanToDecimal(firstDefined(data.odds?.moneyline?.away?.close?.odds, data.odds?.moneyline?.away?.open?.odds)) || makePrice(probs[2]);
  const spreadHomeLine = parseNumber(firstDefined(data.odds?.pointSpread?.home?.close?.line, data.odds?.pointSpread?.home?.open?.line, "-0.5"));
  const spreadAwayLine = parseNumber(firstDefined(data.odds?.pointSpread?.away?.close?.line, data.odds?.pointSpread?.away?.open?.line, spreadHomeLine !== null ? Math.abs(spreadHomeLine) : "+0.5"));
  const spreadProbs = pairProbabilities(
    decimalToProbability(americanToDecimal(firstDefined(data.odds?.pointSpread?.home?.close?.odds, data.odds?.pointSpread?.home?.open?.odds))),
    decimalToProbability(americanToDecimal(firstDefined(data.odds?.pointSpread?.away?.close?.odds, data.odds?.pointSpread?.away?.open?.odds))),
    clamp(probs[0] + probs[1] * 0.35, 0.44, 0.64)
  );
  const spreadHomeOdd = americanToDecimal(firstDefined(data.odds?.pointSpread?.home?.close?.odds, data.odds?.pointSpread?.home?.open?.odds)) || makePrice(spreadProbs[0], 0.95);
  const spreadAwayOdd = americanToDecimal(firstDefined(data.odds?.pointSpread?.away?.close?.odds, data.odds?.pointSpread?.away?.open?.odds)) || makePrice(spreadProbs[1], 0.95);
  const totalLine = parseNumber(firstDefined(data.odds?.total?.over?.close?.line, data.odds?.total?.over?.open?.line, data.odds?.overUnder, 2.5)) || 2.5;
  const totalProbs = pairProbabilities(
    decimalToProbability(americanToDecimal(firstDefined(data.odds?.total?.over?.close?.odds, data.odds?.total?.over?.open?.odds))),
    decimalToProbability(americanToDecimal(firstDefined(data.odds?.total?.under?.close?.odds, data.odds?.total?.under?.open?.odds))),
    0.51
  );
  const overOdd = americanToDecimal(firstDefined(data.odds?.total?.over?.close?.odds, data.odds?.total?.over?.open?.odds)) || makePrice(totalProbs[0], 0.95);
  const underOdd = americanToDecimal(firstDefined(data.odds?.total?.under?.close?.odds, data.odds?.total?.under?.open?.odds)) || makePrice(totalProbs[1], 0.95);
  const doubleChanceHomeDraw = clamp(probs[0] + probs[1] - 0.03, 0.25, 0.89);
  const doubleChanceHomeAway = clamp(probs[0] + probs[2] - 0.03, 0.25, 0.89);
  const doubleChanceDrawAway = clamp(probs[1] + probs[2] - 0.03, 0.25, 0.89);
  const bothTeamsYes = clamp((probs[0] + probs[2]) * 0.58 + 0.13, 0.34, 0.69);
  const bothTeamsNo = clamp(1 - bothTeamsYes, 0.31, 0.66);
  const homeFirstHalf = clamp(probs[0] * 0.66, 0.16, 0.52);
  const drawFirstHalf = clamp(probs[1] * 1.2 + 0.11, 0.18, 0.48);
  const awayFirstHalf = clamp(1 - homeFirstHalf - drawFirstHalf, 0.14, 0.44);
  return [
    createMarket("主胜", homeOdd, probs[0], "main"),
    createMarket("平局", drawOdd, probs[1], "main"),
    createMarket("客胜", awayOdd, probs[2], "main"),
    createMarket(`主队 ${formatLine(spreadHomeLine, "+")}`, spreadHomeOdd, spreadProbs[0], "main"),
    createMarket(`客队 ${formatLine(spreadAwayLine, "+")}`, spreadAwayOdd, spreadProbs[1], "extra"),
    createMarket(`大 ${round(totalLine, 1)}`, overOdd, totalProbs[0], "extra"),
    createMarket(`小 ${round(totalLine, 1)}`, underOdd, totalProbs[1], "extra"),
    createMarket("主/平", makePrice(doubleChanceHomeDraw, 0.92), doubleChanceHomeDraw, "extra"),
    createMarket("主/客", makePrice(doubleChanceHomeAway, 0.92), doubleChanceHomeAway, "extra"),
    createMarket("平/客", makePrice(doubleChanceDrawAway, 0.92), doubleChanceDrawAway, "extra"),
    createMarket("双方进球 是", makePrice(bothTeamsYes, 0.94), bothTeamsYes, "extra"),
    createMarket("双方进球 否", makePrice(bothTeamsNo, 0.94), bothTeamsNo, "extra"),
    createMarket("半场主胜", makePrice(homeFirstHalf, 0.92), homeFirstHalf, "extra"),
    createMarket("半场平局", makePrice(drawFirstHalf, 0.92), drawFirstHalf, "extra"),
    createMarket("半场客胜", makePrice(awayFirstHalf, 0.92), awayFirstHalf, "extra")
  ].filter(Boolean);
}

function nbaMarketsFromData(data) {
  const fallback = data.probs || [0.52, 0.48];
  const homeRaw = decimalToProbability(americanToDecimal(firstDefined(
    data.odds?.moneyline?.home?.close?.odds,
    data.odds?.moneyline?.home?.open?.odds
  )));
  const awayRaw = decimalToProbability(americanToDecimal(firstDefined(
    data.odds?.moneyline?.away?.close?.odds,
    data.odds?.moneyline?.away?.open?.odds
  )));
  const probs = pairProbabilities(homeRaw, awayRaw, fallback[0]);
  const homeOdd = americanToDecimal(firstDefined(data.odds?.moneyline?.home?.close?.odds, data.odds?.moneyline?.home?.open?.odds)) || makePrice(probs[0]);
  const awayOdd = americanToDecimal(firstDefined(data.odds?.moneyline?.away?.close?.odds, data.odds?.moneyline?.away?.open?.odds)) || makePrice(probs[1]);
  const spreadLine = parseNumber(firstDefined(
    data.odds?.spread?.line,
    data.odds?.pointSpread?.home?.close?.line,
    data.odds?.pointSpread?.home?.open?.line,
    data.spread,
    "-2.5"
  )) || -2.5;
  const spreadProbs = pairProbabilities(
    decimalToProbability(americanToDecimal(firstDefined(data.odds?.pointSpread?.home?.close?.odds, data.odds?.pointSpread?.home?.open?.odds))),
    decimalToProbability(americanToDecimal(firstDefined(data.odds?.pointSpread?.away?.close?.odds, data.odds?.pointSpread?.away?.open?.odds))),
    clamp(probs[0] + 0.02, 0.45, 0.62)
  );
  const totalLine = parseNumber(firstDefined(data.odds?.total?.over?.close?.line, data.odds?.total?.over?.open?.line, data.total, 219.5)) || 219.5;
  const totalProbs = pairProbabilities(
    decimalToProbability(americanToDecimal(firstDefined(data.odds?.total?.over?.close?.odds, data.odds?.total?.over?.open?.odds))),
    decimalToProbability(americanToDecimal(firstDefined(data.odds?.total?.under?.close?.odds, data.odds?.total?.under?.open?.odds))),
    0.5
  );
  const spreadHomeOdd = americanToDecimal(firstDefined(data.odds?.pointSpread?.home?.close?.odds, data.odds?.pointSpread?.home?.open?.odds)) || makePrice(spreadProbs[0], 0.95);
  const spreadAwayOdd = americanToDecimal(firstDefined(data.odds?.pointSpread?.away?.close?.odds, data.odds?.pointSpread?.away?.open?.odds)) || makePrice(spreadProbs[1], 0.95);
  const overOdd = americanToDecimal(firstDefined(data.odds?.total?.over?.close?.odds, data.odds?.total?.over?.open?.odds)) || makePrice(totalProbs[0], 0.95);
  const underOdd = americanToDecimal(firstDefined(data.odds?.total?.under?.close?.odds, data.odds?.total?.under?.open?.odds)) || makePrice(totalProbs[1], 0.95);
  const firstHalfHome = clamp(probs[0] * 0.96, 0.34, 0.66);
  const firstHalfAway = clamp(1 - firstHalfHome, 0.34, 0.66);
  const firstQuarterHome = clamp(probs[0] * 0.98, 0.34, 0.66);
  const firstQuarterAway = clamp(1 - firstQuarterHome, 0.34, 0.66);
  return [
    createMarket("主胜", homeOdd, probs[0], "main"),
    createMarket("客胜", awayOdd, probs[1], "main"),
    createMarket(`主队 ${formatLine(spreadLine, "+")}`, spreadHomeOdd, spreadProbs[0], "main"),
    createMarket(`客队 ${formatLine(-spreadLine, "+")}`, spreadAwayOdd, spreadProbs[1], "extra"),
    createMarket(`大 ${round(totalLine, 1)}`, overOdd, totalProbs[0], "extra"),
    createMarket(`小 ${round(totalLine, 1)}`, underOdd, totalProbs[1], "extra"),
    createMarket("上半场主胜", makePrice(firstHalfHome, 0.94), firstHalfHome, "extra"),
    createMarket("上半场客胜", makePrice(firstHalfAway, 0.94), firstHalfAway, "extra"),
    createMarket("第1节主胜", makePrice(firstQuarterHome, 0.95), firstQuarterHome, "extra"),
    createMarket("第1节客胜", makePrice(firstQuarterAway, 0.95), firstQuarterAway, "extra"),
    createMarket(`总分 200-${Math.max(200, Math.floor(totalLine))}`, makePrice(0.29, 0.95), 0.29, "extra"),
    createMarket(`总分 ${Math.ceil(totalLine)}+`, makePrice(0.34, 0.95), 0.34, "extra")
  ].filter(Boolean);
}

function twoWayMarketsFromData(data) {
  const homeProb = clamp(Number(data.homeProb || 0.52), 0.16, 0.84);
  const awayProb = clamp(1 - homeProb, 0.16, 0.84);
  return [
    createMarket("主胜", makePrice(homeProb), homeProb, "main"),
    createMarket("客胜", makePrice(awayProb), awayProb, "main"),
    createMarket("让分主胜", makePrice(clamp(homeProb - 0.02, 0.18, 0.82), 0.95), clamp(homeProb - 0.02, 0.18, 0.82), "extra"),
    createMarket("让分客胜", makePrice(clamp(awayProb - 0.02, 0.18, 0.82), 0.95), clamp(awayProb - 0.02, 0.18, 0.82), "extra"),
    createMarket("大分", makePrice(0.49, 0.95), 0.49, "extra"),
    createMarket("小分", makePrice(0.48, 0.95), 0.48, "extra"),
    createMarket("第一局主胜", makePrice(clamp(homeProb * 0.94, 0.18, 0.82), 0.94), clamp(homeProb * 0.94, 0.18, 0.82), "extra"),
    createMarket("第一局客胜", makePrice(clamp(awayProb * 0.94, 0.18, 0.82), 0.94), clamp(awayProb * 0.94, 0.18, 0.82), "extra")
  ].filter(Boolean);
}

function teamName(competitor) {
  return competitor?.team?.displayName
    || competitor?.team?.shortDisplayName
    || competitor?.team?.name
    || competitor?.athlete?.displayName
    || competitor?.athlete?.shortName
    || competitor?.displayName
    || "Team";
}

function teamLogo(competitor) {
  return competitor?.team?.logo
    || competitor?.athlete?.flag?.href
    || competitor?.athlete?.headshot
    || "";
}

function fixturePriority(item) {
  const start = new Date(item.startAt || 0).getTime();
  const dayDiff = Math.floor(start / DAY) - Math.floor(Date.now() / DAY);
  const isWorldCup = item.sport === text.worldCup;
  const sportRank = item.sport === text.worldCup ? 0 : item.sport === "NBA" ? 1 : item.sport === "网球" ? 2 : 3;
  return (isWorldCup && dayDiff >= 0 && dayDiff < 3 ? -1000 : 0)
    + (dayDiff === 0 ? -400 : 0)
    + sportRank * 10
    + start / 1e11;
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
  const homeName = teamName(home);
  const awayName = teamName(away);
  const odds = competition?.odds?.[0] || null;
  const fallbackProbs = marketProbability(String(event.id || "").length, index, sport);
  const fixture = {
    id: `live-${sport.toLowerCase().replace(/\W/g, "")}-${event.id || crypto.createHash("md5").update(`${sport}-${homeName}-${awayName}-${startAt}`).digest("hex").slice(0, 10)}`,
    sport,
    league: competition?.altGameNote || event.league?.name || (sport === "NBA" ? "NBA Auto Board" : "FIFA World Cup Auto"),
    startAt,
    endAt,
    home: homeName,
    away: awayName,
    type: sport === "NBA" ? "nba" : "football",
    source: odds?.provider?.displayName || odds?.provider?.name
      ? `ESPN / ${odds.provider.displayName || odds.provider.name}`
      : "ESPN scoreboard",
    venue: competition?.venue?.fullName || competition?.venue?.address?.city || event?.status?.type?.detail || "",
    homeLogo: teamLogo(home),
    awayLogo: teamLogo(away),
    probs: fallbackProbs,
    odds
  };
  fixture.markets = sport === "NBA" ? nbaMarketsFromData(fixture) : footballMarketsFromData(fixture);
  fixture.priority = fixturePriority(fixture);
  return fixture;
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

function supplementalFixtures() {
  const sports = [
    { sport: "网球", league: "ATP 热门场", teams: [["Carlos Alcaraz", "Alex de Minaur"], ["Novak Djokovic", "Taylor Fritz"], ["Jannik Sinner", "Ben Shelton"]], hours: [14, 19, 22], duration: 125, ticket: "flow" },
    { sport: "羽毛球", league: "国际公开赛", teams: [["李梓嘉", "石宇奇"], ["安东森", "昆拉武特"], ["周天成", "骆建佑"]], hours: [12, 17, 21], duration: 80, ticket: "flow" },
    { sport: "电竞", league: "全球冠军赛", teams: [["Blue Nova", "Red Pulse"], ["Arctic Core", "Quantum Five"], ["Radiant X", "Dire Zero"]], hours: [16, 20, 23], duration: 150, ticket: "flow" }
  ];
  const fixtures = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  sports.forEach((group, groupIndex) => {
    for (let day = 0; day < 3; day += 1) {
      const start = new Date(today.getTime() + day * DAY);
      start.setHours(group.hours[day], 0, 0, 0);
      const teams = group.teams[(groupIndex + day) % group.teams.length];
      const homeProb = clamp(0.47 + ((groupIndex + day) % 3) * 0.05, 0.36, 0.64);
      const base = {
        id: `auto-${group.sport}-${start.toISOString().slice(0, 10)}-${groupIndex}-${day}`.replace(/[^\w-]/g, ""),
        sport: group.sport,
        league: group.league,
        startAt: start.toISOString(),
        endAt: new Date(start.getTime() + group.duration * 60 * 1000).toISOString(),
        home: teams[0],
        away: teams[1],
        type: "other",
        ticket: group.ticket,
        source: "Auto schedule",
        probs: [homeProb, 1 - homeProb]
      };
      base.markets = twoWayMarketsFromData({ homeProb });
      base.priority = fixturePriority(base);
      fixtures.push(base);
    }
  });
  return fixtures.filter(item => Date.now() < new Date(item.endAt).getTime());
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
  const worldCupHours = [1, 5, 9, 23];
  for (let i = 0; i < 5; i += 1) {
    const base = new Date(today.getTime() + i * DAY);
    const nbaStart = new Date(base);
    nbaStart.setHours(8, 30, 0, 0);
    const nba = nbaTeams[i % nbaTeams.length];
    const nbaFixture = {
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
    };
    nbaFixture.markets = nbaMarketsFromData(nbaFixture);
    nbaFixture.priority = fixturePriority(nbaFixture);
    fixtures.push(nbaFixture);
    const matchesPerDay = i === 0 ? 4 : 2;
    for (let slot = 0; slot < matchesPerDay; slot += 1) {
      const wcStart = new Date(base);
      wcStart.setHours(worldCupHours[(i + slot) % worldCupHours.length], 0, 0, 0);
      const wcTeams = footballTeams[(i * 2 + slot) % footballTeams.length];
      const wcFixture = {
        id: `auto-wc-${wcStart.toISOString().slice(0, 10)}-${i}-${slot}`,
        sport: text.worldCup,
        league: `FIFA World Cup Auto · Matchday ${i + 1}`,
        startAt: wcStart.toISOString(),
        endAt: new Date(wcStart.getTime() + 130 * 60 * 1000).toISOString(),
        home: wcTeams[0],
        away: wcTeams[1],
        type: "football",
        source: "Auto board",
        probs: [0.42 + ((slot + i) % 3) * 0.05, 0.27, 0.31 - ((slot + i) % 3) * 0.03]
      };
      wcFixture.markets = footballMarketsFromData(wcFixture);
      wcFixture.priority = fixturePriority(wcFixture);
      fixtures.push(wcFixture);
    }
  }
  return [...fixtures, ...supplementalFixtures()]
    .filter(item => Date.now() < new Date(item.endAt).getTime())
    .sort((a, b) => a.priority - b.priority || new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

async function autoFixtures() {
  try {
    const live = await remoteFixtures();
    if (live.length) {
      const merged = [...live, ...supplementalFixtures()];
      const seen = new Set();
      return merged
        .filter(item => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return Date.now() < new Date(item.endAt).getTime();
        })
        .sort((a, b) => a.priority - b.priority || new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    }
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
    if (req.method === "POST" && url.pathname === "/api/auth/request-whatsapp-code") {
      const body = await readJson(req);
      const phone = normalizePhone(body.phone || body.name || "");
      if (!phone) return json(res, 400, { ok: false, message: text.badPhone });
      try {
        await requestWhatsappCode(phone);
        return json(res, 200, { ok: true, message: "WhatsApp code sent" });
      } catch (error) {
        const message = error.message === text.whatsappUnavailable ? text.whatsappUnavailable : (error.message || text.whatsappSendFailed);
        return json(res, 503, { ok: false, message });
      }
    }
    if (req.method === "POST" && url.pathname === "/api/auth/register-whatsapp") {
      const body = await readJson(req);
      const name = normalizePhone(body.name || body.phone || "");
      const pass = String(body.pass || "").trim();
      const code = String(body.code || "").trim();
      if (!name) return json(res, 400, { ok: false, message: text.badPhone });
      if (!validPassword(pass)) return json(res, 400, { ok: false, message: text.badPassword });
      if (!code) return json(res, 400, { ok: false, message: text.codeRequired });
      const state = readState();
      if (state.users[name]) return json(res, 409, { ok: false, message: text.duplicate });
      try {
        const approved = await verifyWhatsappCode(name, code);
        if (!approved) return json(res, 400, { ok: false, message: text.whatsappCodeWrong });
      } catch (error) {
        const message = error.message === text.whatsappUnavailable ? text.whatsappUnavailable : (error.message || text.whatsappCodeWrong);
        return json(res, 503, { ok: false, message });
      }
      state.users[name] = { name, phone: name, pass, balance: 0, createdAt: now(), verifiedVia: "whatsapp" };
      addLog(state, name, text.registerLog, 0, 0, text.register);
      return json(res, 200, { ok: true, currentUser: name, state: writeState(state) });
    }
    if (req.method === "POST" && url.pathname === "/api/register") {
      const body = await readJson(req);
      const name = normalizePhone(body.name || "");
      const email = normalizeEmail(body.email || "");
      const pass = String(body.pass || "").trim();
      if (!name) return json(res, 400, { ok: false, message: text.badPhone });
      if (!email) return json(res, 400, { ok: false, message: text.emailRequired });
      if (!validEmail(email)) return json(res, 400, { ok: false, message: text.badEmail });
      if (!validPassword(pass)) return json(res, 400, { ok: false, message: text.badPassword });
      const state = readState();
      if (state.users[name]) return json(res, 409, { ok: false, message: text.duplicate });
      state.users[name] = { name, phone: name, email, pass, balance: 0, createdAt: now() };
      addLog(state, name, text.registerLog, 0, 0, text.register);
      return json(res, 200, { ok: true, currentUser: name, state: writeState(state) });
    }
    if (req.method === "POST" && url.pathname === "/api/password-reset") {
      const body = await readJson(req);
      const name = normalizePhone(body.name || "");
      const email = normalizeEmail(body.email || "");
      const pass = String(body.pass || "").trim();
      const captchaQuestion = String(body.captchaQuestion || "").trim();
      const captchaAnswer = String(body.captchaAnswer || "").trim();
      if (!name) return json(res, 400, { ok: false, message: text.badPhone });
      if (!email) return json(res, 400, { ok: false, message: text.emailRequired });
      if (!validEmail(email)) return json(res, 400, { ok: false, message: text.badEmail });
      if (!validPassword(pass)) return json(res, 400, { ok: false, message: text.badPassword });
      if (!captchaQuestion || !captchaAnswer) {
        return json(res, 400, { ok: false, message: text.captchaRequired });
      }
      if (!validCaptcha(captchaQuestion, captchaAnswer)) {
        return json(res, 400, { ok: false, message: text.captchaWrong });
      }
      const state = readState();
      if (!state.users[name]) {
        return json(res, 404, { ok: false, message: text.userMissing });
      }
      if (normalizeEmail(state.users[name].email || "") !== email) {
        return json(res, 400, { ok: false, message: text.emailMismatch });
      }
      state.users[name].pass = pass;
      addLog(state, name, text.resetPasswordLog, 0, 0, text.resetPassword);
      return json(res, 200, { ok: true, currentUser: "", state: writeState(state) });
    }
    if (req.method === "POST" && url.pathname === "/api/login") {
      const body = await readJson(req);
      const name = normalizePhone(body.name || "");
      const pass = String(body.pass || "").trim();
      const captchaQuestion = String(body.captchaQuestion || "").trim();
      const captchaAnswer = String(body.captchaAnswer || "").trim();
      if (!name) {
        return json(res, 400, { ok: false, message: text.badPhone });
      }
      if (!captchaQuestion || !captchaAnswer) {
        return json(res, 400, { ok: false, message: text.captchaRequired });
      }
      if (!validCaptcha(captchaQuestion, captchaAnswer)) {
        return json(res, 400, { ok: false, message: text.captchaWrong });
      }
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
