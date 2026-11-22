import fs from "fs";
import path from "path";
import makeWASocket, {
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import pino from "pino";
import { mkdir } from "fs/promises";
import { log } from "./logger.js";
import config from "./settings.js";
import { openDatabase } from "./sqlite.js";
import { useSQLiteAuthState, attachSocketState, makeSendResilient, guardGroupAddFlood, getLiveSocketFor, probeAlive } from "./connection.js";
import { db } from "../database/db.js";
import { handleMessage, registerGroupCacheEvents } from "./messageHandler.js";
import { registerAntifeatures } from "./مضاد/index.js";
import { initButtons } from "./buttons.js";

const SUBBOTS_DIR = "./sessions/subbots";
if (!fs.existsSync(SUBBOTS_DIR)) fs.mkdirSync(SUBBOTS_DIR, { recursive: true });

export const activeBots = new Map();
const sockets = new Map();
let mainSock = null;

const logger = pino({ level: "silent" });
const PAIRING_TIMEOUT_MS = 60_000;
// مهلة قصيرة قبل إعادة الاتصال بعد 515: الإعادة الفورية تُنتج مقبساً زومبياً.
const RESTART_DELAY_MS = config.reconnectDelay;
// كشف المقبس الزومبي بعد "الاتصال": مفتوح لكن الخادم لا يستجيب.
const ZOMBIE_CHECK_DELAY_MS = 6000;

// قفل في الذاكرة حتى لا يردّ أكثر من بوت على الأمر نفسه مرتين.
const claimedCmds = new Set();

export function claimOnce(msgId) {
  if (claimedCmds.has(msgId)) return false;
  claimedCmds.add(msgId);
  setTimeout(() => claimedCmds.delete(msgId), 30_000);
  return true;
}

function backoffDelay(attempt) {
  const base = 5000;
  const capped = Math.min(60_000, base * Math.pow(1.6, Math.min(attempt, 8)));
  return capped + Math.random() * 1500;
}

function isSessionRegistered(sessionDir) {
  const dbPath = path.join(sessionDir, "auth.db");
  if (!fs.existsSync(dbPath)) return false;
  try {
    const authDb = openDatabase(dbPath, { readonly: true });
    const row = authDb.prepare("SELECT data FROM auth WHERE id = ?").get("creds");
    authDb.close();
    if (!row) return false;
    return !!JSON.parse(row.data).registered;
  } catch {
    return false;
  }
}

function esLabelGenerico(label) {
  return !label || label === "Subbot" || label === "MAIN" || label.startsWith("SUB_");
}

export function registerMainBot(sock, label = "MAIN") {
  mainSock = sock;
  const rawJid = sock.user?.id || "";
  const jid = rawJid ? rawJid.split(":")[0].split("@")[0] + "@s.whatsapp.net" : "";
  const status = jid ? "online" : "connecting";

  const rawLid = sock.user?.lid || "";
  const lid = rawLid ? rawLid.split(":")[0] : "";

  const existing = jid ? db.getBot(jid) : null;
  const labelFinal = !esLabelGenerico(existing?.label) ? existing.label : label;

  activeBots.set("main", { label: labelFinal, jid, status, isMain: true, lid });

  if (jid) {
    for (const old of db.getAllBots().filter((b) => b.isMain && b.jid !== jid)) {
      db.setBot(old.jid, { isMain: false, status: "offline" }, true);
    }
    // force=true: صف قديم بـisMain:false كان يمنع ترقية البوت الرئيسي.
    db.setBot(jid, { label: labelFinal, jid, status, isMain: true, lid }, true);
    global.mainBotNum = jid.split("@")[0];
    return;
  }

  // المعرّف مجهول حتى يُفتح المقبس — سجّله عند فتحه.
  sock.ev.on("connection.update", ({ connection }) => {
    if (connection !== "open") return;
    mainSock = sock;
    const currentRawJid = sock.user?.id || "";
    const currentJid = currentRawJid ? currentRawJid.split(":")[0].split("@")[0] + "@s.whatsapp.net" : "";
    const currentLid = (sock.user?.lid || "").split(":")[0];

    if (!currentJid) return;

    for (const old of db.getAllBots().filter((b) => b.isMain && b.jid !== currentJid)) {
      db.setBot(old.jid, { isMain: false, status: "offline" }, true);
    }

    const existingNow = db.getBot(currentJid);
    const labelFinalNow = !esLabelGenerico(existingNow?.label) ? existingNow.label : label;

    activeBots.set("main", { label: labelFinalNow, jid: currentJid, status: "online", isMain: true, lid: currentLid });
    // force=true: صف قديم بـisMain:false كان يمنع ترقية البوت الرئيسي.
    db.setBot(currentJid, { label: labelFinalNow, jid: currentJid, status: "online", isMain: true, lid: currentLid }, true);
    global.mainBotNum = currentJid.split("@")[0];
  });
}

export function getMainSock() {
  return mainSock;
}

export function getAllSockets() {
  const list = [];
  if (mainSock) list.push(mainSock);
  for (const entry of sockets.values()) if (entry?.sock) list.push(entry.sock);
  return list;
}

/**
 * يُعيد المقبس الحيّ لنفس الرقم.
 *
 * بعد إعادة الاتصال ينشأ مقبس جديد ويُترك القديم مغلقاً؛ فالمقبس المُمرَّر إلى
 * handleMessage قد لا يعود صالحاً للإرسال (يفشل بـ428 "Connection Closed").
 */
export function getLiveSock(sock) {
  if (!sock) return sock;
  if (sock.isOpen) return sock;

  const num = String(sock.user?.id || "").split(":")[0].split("@")[0];
  if (!num) return sock;

  const live = getLiveSocketFor(num);
  return live || sock;
}

export function updateBotStatus(id, data) {
  const current = activeBots.get(id) || {};
  activeBots.set(id, { ...current, ...data });

  const targetKey = data.jid || id;
  const existing = db.getBot(targetKey);

  if (!esLabelGenerico(existing?.label) && data.label) delete data.label;

  if (data.jid) {
    db.deleteBot(id);
    db.setBot(data.jid, data);
  } else {
    db.setBot(id, data);
  }
}

export function removeSubbot(id) {
  const entry = sockets.get(id);
  if (entry) {
    try {
      entry.closeDb?.();
    } catch {}
    try {
      entry.sock?.end?.(new Error("removed"));
    } catch {}
    try {
      entry.sock?.ws?.close?.();
    } catch {}
    sockets.delete(id);
  }
  const botData = activeBots.get(id);
  activeBots.delete(id);
  if (botData?.jid) db.deleteBot(botData.jid);
  db.deleteBot(id);

  const sessionDir = `${SUBBOTS_DIR}/${id}`;
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
    log.warn(`[MANAGER] حُذفت جلسة ${id} بالكامل`);
  }
}

function handleSockExit(id) {
  sockets.delete(id);
  const sessionDir = `${SUBBOTS_DIR}/${id}`;

  if (isSessionRegistered(sessionDir)) {
    log.info(`[MANAGER] إعادة تشغيل البوت الفرعي ${id} بعد لحظات...`);
    setTimeout(() => launchSubbot(id), 5000 + Math.random() * 1500);
  } else {
    log.warn(`[MANAGER] ${id} لم يكمل الاقتران — حذف الجلسة`);
    const botData = activeBots.get(id);
    activeBots.delete(id);
    if (botData?.jid) db.deleteBot(botData.jid);
    db.deleteBot(id);
    if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });
  }
}

async function startSubbotConnection(id, sessionDir, phoneNumber = null, onCode = null, _attempt = 0) {
  await mkdir(sessionDir, { recursive: true });

  const { state, saveCreds, closeDb } = await useSQLiteAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();
  const useCode = !!phoneNumber && !state.creds.registered;

  let sock;
  let connected = false;
  const pendingMessages = [];
  let pairingTimer = null;
  let zombieTimer = null;

  function clearPairingTimer() {
    if (pairingTimer) {
      clearTimeout(pairingTimer);
      pairingTimer = null;
    }
  }

  async function flushPending() {
    const queue = pendingMessages.splice(0);
    for (const msg of queue) handleMessage(sock, msg, id.toUpperCase()).catch(() => {});
  }

  try {
    sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal: false,
      logger,
      browser: ["Ubuntu", "Chrome", "20.0.04"],
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      connectTimeoutMs: 60000,
      // مُهلة كشف الانقطاع = هذه القيمة + 5ث (الافتراضي في المكتبة 30000).
      keepAliveIntervalMs: 30000,
      retryRequestDelayMs: 3000,
      defaultQueryTimeoutMs: 60000,
    });
  } catch (e) {
    try {
      closeDb();
    } catch {}
    log.error(`[${id}] فشل إنشاء الاتصال: ${e.message}`);
    setTimeout(() => startSubbotConnection(id, sessionDir, phoneNumber, onCode, _attempt + 1), backoffDelay(_attempt));
    return;
  }

  sockets.set(id, { sock, closeDb });
  // وسم النوع + حالة الفتح: plugins تفحص isMainBot لتمييز الرئيسي من الفرعي.
  sock.isMainBot = false;
  attachSocketState(sock);
  registerGroupCacheEvents(sock);
  registerAntifeatures(sock, id.toUpperCase());
  // الفرعية تحتاج sendButtonMessage أيضاً (الأوامر التفاعلية)، وحماية 428.
  initButtons(sock);
  makeSendResilient(sock);
  guardGroupAddFlood(sock);

  if (useCode) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      let code = await sock.requestPairingCode(phoneNumber.replace(/\D/g, ""));
      code = code?.match(/.{1,4}/g)?.join("-") || code;
      onCode?.(code);

      pairingTimer = setTimeout(() => {
        if (!connected) {
          updateBotStatus(id, { status: "pairing_timeout" });
          log.warn(`[MANAGER] البوت الفرعي ${id} لم يُدخل الرمز في الوقت المحدد`);
          try {
            sock.end(new Error("pairing_timeout"));
          } catch {}
          removeSubbot(id);
        }
      }, PAIRING_TIMEOUT_MS);
    } catch (e) {
      log.error(`[${id}] تعذّر طلب الرمز: ${e.message}`);
      try {
        closeDb();
      } catch {}
      sockets.delete(id);
      return;
    }
  }

  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      connected = true;
      clearPairingTimer();
      sock.markOpen?.();

      const rawJid = sock.user?.id || "";
      const jidLimpio = rawJid ? rawJid.split(":")[0].split("@")[0] + "@s.whatsapp.net" : "";
      const lidLimpio = (sock.user?.lid || "").split(":")[0];
      const pushName = sock.user?.name || sock.user?.verifiedName || "";

      updateBotStatus(id, {
        jid: jidLimpio,
        status: "online",
        label: id.toUpperCase(),
        isMain: false,
        lid: lidLimpio,
        pushName,
      });
      await flushPending();

      // المقبس الزومبي: "متصل" لكنه لا يستقبل أي رسالة — أعد الاتصال فوراً
      // بدل انتظار 408 بعد ~50 ثانية.
      clearTimeout(zombieTimer);
      zombieTimer = setTimeout(() => {
        if (!connected || sock.isOpen === false) return;
        probeAlive(sock).then((alive) => {
          if (alive || !connected || sock.isOpen === false) return;
          log.warn(`[MANAGER] لا استجابة من الخادم للبوت ${id} — إعادة الاتصال...`);
          const err = new Error("zombie socket");
          err.output = { statusCode: DisconnectReason.restartRequired };
          try {
            sock.end(err);
          } catch {}
        });
      }, ZOMBIE_CHECK_DELAY_MS);
      zombieTimer.unref?.();
    }

    if (connection === "close") {
      connected = false;
      clearPairingTimer();
      clearTimeout(zombieTimer);
      sock.markClosed?.();
      const code = lastDisconnect?.error?.output?.statusCode;
      updateBotStatus(id, { status: "offline", jid: "" });
      try {
        closeDb();
      } catch {}
      sockets.delete(id);

      if (code === DisconnectReason.loggedOut) {
        log.warn(`[MANAGER] البوت الفرعي ${id} سجّل الخروج — حذف...`);
        removeSubbot(id);
        return;
      }

      if (code === DisconnectReason.connectionReplaced) return;

      if (code === DisconnectReason.badSession || code === 403) {
        log.warn(`[MANAGER] جلسة ${id} تالفة أو محظورة — حذف...`);
        removeSubbot(id);
        return;
      }

      // احفظ المفاتيح وابدأ ميزانية المحاولات من جديد بعد ربط ناجح.
      // مهلة قصيرة قبل إعادة الاتصال: الإعادة الفورية بعد 515 تُنتج مقبساً
      // "مفتوحاً" لا يستقبل رسائل (زومبي) يُسقَط لاحقاً بـ408.
      if (code === DisconnectReason.restartRequired) {
        setTimeout(() => startSubbotConnection(id, sessionDir, null, null, 0), RESTART_DELAY_MS);
        return;
      }

      setTimeout(() => startSubbotConnection(id, sessionDir, null, null, _attempt + 1), backoffDelay(_attempt));
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (!msg.message) continue;
      if (msg.key?.remoteJid === "status@broadcast") continue;
      // مجموعات فقط: لا تُخزَّن ولا تُعالَج رسائل الخاص إطلاقاً.
      if (config.groupsOnly && !msg.key?.remoteJid?.endsWith("@g.us")) continue;
      if (!connected) {
        pendingMessages.push(msg);
        continue;
      }
      handleMessage(sock, msg, id.toUpperCase()).catch(() => {});
    }
  });
}

export function launchSubbot(id) {
  if (sockets.has(id)) return;

  const sessionDir = path.resolve(`${SUBBOTS_DIR}/${id}`);
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

  log.info(`[MANAGER] تشغيل البوت الفرعي: ${id}`);

  startSubbotConnection(id, sessionDir).catch((e) => {
    log.error(`[MANAGER] خطأ في تشغيل ${id}: ${e.message}`);
    handleSockExit(id);
  });
}

export async function requestSubbotCode(id, phoneNumber, sock, from) {
  const sessionDir = path.resolve(`${SUBBOTS_DIR}/${id}`);
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
  if (sockets.has(id)) removeSubbot(id);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("انتهت مهلة انتظار الرمز")), 15000);

    const cleanupTimeout = setTimeout(() => {
      const bot = activeBots.get(id);
      if (!bot || bot.status !== "online") {
        log.warn(`[MANAGER] البوت الفرعي ${id} لم يتصل — حذف`);
        removeSubbot(id);
      }
    }, 70_000);

    startSubbotConnection(id, sessionDir, phoneNumber, (code) => {
      clearTimeout(timeout);
      resolve(code);
    }).catch((e) => {
      clearTimeout(timeout);
      clearTimeout(cleanupTimeout);
      reject(e);
    });

    const checkOnline = setInterval(() => {
      const bot = activeBots.get(id);
      if (bot?.status === "online") {
        clearInterval(checkOnline);
        clearTimeout(cleanupTimeout);
        const userNum = id.replace("sub_", "");
        const userJid = bot.jid || `${userNum}@s.whatsapp.net`;
        sock
          .sendMessage(from, {
            text: `📍 *@${userNum} ربط بوتاً فرعياً بنجاح*\n> • يمكنك استخدام *.حذف-بوت* لفصله متى شئت.`,
            mentions: [userJid],
          })
          .catch((e) => log.error(`[MANAGER] تعذّر إرسال رسالة النجاح: ${e.message}`));
      }
    }, 2000);

    setTimeout(() => clearInterval(checkOnline), 75_000);
  });
}

export function launchAllSubbots() {
  if (!fs.existsSync(SUBBOTS_DIR)) return;
  const dirs = fs
    .readdirSync(SUBBOTS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  if (dirs.length === 0) return;

  log.info(`[MANAGER] إعادة تشغيل ${dirs.length} بوت فرعي...`);
  for (const id of dirs) {
    const sessionDir = path.resolve(`${SUBBOTS_DIR}/${id}`);
    if (isSessionRegistered(sessionDir)) {
      launchSubbot(id);
    } else {
      log.warn(`[MANAGER] ${id} لم يكمل الاقتران — حذف جلسة يتيمة`);
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
  }
}

/**
 * يتفاعل مع رسالة القناة من كل بوت حيّ، موزّعة عشوائياً داخل
 * النافذة حتى لا تصطدم كلها بالواجهة في اللحظة نفسها.
 */
export async function broadcastReaccionCanal({ canalJid, serverId, emoji, ventanaMs = 5000 }) {
  const bots = getAllSockets().filter((s) => s && s.user);

  const tasks = bots.map(async (s) => {
    await new Promise((r) => setTimeout(r, Math.random() * ventanaMs));
    await s.newsletterReactMessage(canalJid, serverId, emoji);
  });

  const results = await Promise.allSettled(tasks);

  let ok = 0;
  let fail = 0;
  for (const r of results) {
    if (r.status === "fulfilled") ok++;
    else {
      fail++;
      log.error(`[MANAGER] فشل تفاعل بوت مع القناة: ${r.reason?.message}`);
    }
  }

  return { ok, fail, total: bots.length };
}
