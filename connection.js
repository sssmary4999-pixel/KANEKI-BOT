import makeWASocket, {
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  initAuthCreds,
  BufferJSON,
  proto,
} from "@whiskeysockets/baileys";
import pino from "pino";
import { mkdir } from "fs/promises";
import path from "path";
import fs from "fs";
import qrcode from "qrcode-terminal";
import { randomBytes } from "crypto";
import { log } from "./logger.js";
import { openDatabase } from "./sqlite.js";
import { askPairingDetails } from "./prompt.js";
import config from "./settings.js";
import { handleMessage, registerGroupCacheEvents } from "./messageHandler.js";
import { registerAntifeatures } from "./مضاد/index.js";
import { initButtons } from "./buttons.js";

// واتساب يحتاج لحظة بعد المصافحة قبل أن يقبل طلب الاقتران.
const PAIRING_DELAY_MS = 3000;
// لا تُغلق إلا مقبساً لم يُفتح قط وليس في انتظار رمز اقتران.
const CONNECTION_TIMEOUT_MS = 75_000;
// بعد 515 (restart required) يبقى الخادم مرتبطاً بالجلسة القديمة لحظة؛ إعادة
// الاتصال الفورية تُنتج مقبساً "مفتوحاً" لا يستقبل رسائل (زومبي) يُسقَط بـ408
// بعد ~50 ث. المهلة نفسها التي نجحت في السجل التجريبي (5 ث).
const RESTART_DELAY_MS = config.reconnectDelay;
// كشف المقبس الزومبي: مفتوح لكن الخادم لا يرد على أي استعلام.
const ZOMBIE_CHECK_DELAY_MS = 6000;
const ZOMBIE_PROBE_MS = 8000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** إعادة اتصال واحدة لكل مجلد جلسة، فلا يتسابق إغلاقان. */
const reconnectLocks = new Set();

/** هل الخطأ يعني أن المقبس أُغلق؟ (واتساب يرد 428 "Connection Closed"). */
export function isConnClosed(err) {
  const statusCode = err?.output?.statusCode ?? err?.data?.statusCode;
  if (statusCode === 428) return true;
  return /connection closed/i.test(String(err?.message || err?.output?.payload?.message || ""));
}

const numOf = (sock) => String(sock?.user?.id || "").split(":")[0].split("@")[0];

/**
 * سجلّ المقبس الحيّ لكل رقم.
 *
 * إعادة الاتصال تنشئ مقبساً جديداً وتترك القديم ميتاً؛ فالإرسال على القديم
 * يفشل بـ428. نحتفظ بأحدث مقبس لكل رقم لنعيد توجيه الإرسال إليه.
 */
const liveRegistry = new Map();

export function getLiveSocketFor(number) {
  return liveRegistry.get(String(number || "")) || null;
}

function trackLive(sock) {
  const num = numOf(sock);
  if (!num) return;
  sock.__num = num;
  liveRegistry.set(num, sock);
}

/**
 * يضيف حالة الفتح للمقبس: `isOpen` و`waitForOpen()` و`markOpen/markClosed`.
 *
 * `waitForOpen` ضرورية بعد الربط: ينتظر واتساب لحظة قبل قبول الإرسال، فأي
 * أمر في تلك النافذة يفشل بـ428.
 */
export function attachSocketState(sock) {
  sock.isOpen = false;
  sock.__num = numOf(sock);
  let waiters = [];

  sock.waitForOpen = (timeoutMs = 30000) =>
    new Promise((resolve) => {
      if (sock.isOpen) return resolve(true);
      const onOpen = () => {
        clearTimeout(timer);
        resolve(true);
      };
      const timer = setTimeout(() => {
        waiters = waiters.filter((w) => w !== onOpen);
        resolve(false);
      }, timeoutMs);
      timer.unref?.();
      waiters.push(onOpen);
    });

  sock.markOpen = () => {
    sock.isOpen = true;
    trackLive(sock);
    const pending = waiters;
    waiters = [];
    for (const fn of pending) fn();
  };

  sock.markClosed = () => {
    sock.isOpen = false;
  };

  return sock;
}

/** ينتظر حتى يصبح مقبس هذا الرقم مفتوحاً، ويُعيده. */
async function waitForLive(sock, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const live = liveRegistry.get(sock.__num);
    if (live?.isOpen) return live;
    if (live) {
      if (await live.waitForOpen?.(Math.min(1000, Math.max(0, deadline - Date.now())))) return live;
    } else {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return null;
}

/**
 * يجعل دوال الإرسال الشبكية تُعيد المحاولة على المقبس الحيّ عند 428، بدل
 * إسقاط الأمر بخطأ "Connection Closed".
 */
export function makeSendResilient(sock) {
  if (sock.__resilient) return sock;
  sock.__resilient = true;
  sock.__orig = {};

  const methods = [
    "sendMessage", "sendButtonMessage", "relayMessage", "groupMetadata",
    "groupParticipantsUpdate", "updateMediaMessage", "profilePictureUrl",
    "newsletterMetadata", "groupSettingUpdate", "groupToggleEphemeral",
    "groupRevokeInvite", "groupInviteCode", "groupGetInviteInfo",
    "groupAcceptInvite", "waUploadToServer",
  ];

  for (const name of methods) {
    const original = sock[name];
    if (typeof original !== "function") continue;
    sock.__orig[name] = original;

    sock[name] = async (...args) => {
      const invoke = (t) => (t.__orig?.[name] || t[name]).apply(t, args);
      try {
        return await invoke(sock);
      } catch (err) {
        if (!isConnClosed(err)) throw err;
        const live = await waitForLive(sock, 30000);
        if (!live) throw err;
        return await invoke(live);
      }
    };
  }

  return sock;
}

// حماية الإضافات الصادرة: تمنع استخدام البوت نفسه أداةً لإغراق المجموعة.
// هجوم الإغراق الشائع يستدعي groupParticipantsUpdate(action='add') عدّة مرات
// متتالية على أرقام وهمية، فلا يُبَثّ حدث دخول (الأرقام غير موجودة) ويبقى
// المضاد المبني على الأحداث أعمى. الحجب هنا يقطع الهجوم من مصدره.
const ADD_GUARD_WINDOW_MS = 6_000;
const ADD_GUARD_MAX = 3;
const ADD_GUARD_COOLDOWN_MS = 60_000;
const addGuard = new Map();

/** يلفّ groupParticipantsUpdate فيمنع رشقات الإضافة المتتالية. */
export function guardGroupAddFlood(sock) {
  if (sock.__addGuard || typeof sock.groupParticipantsUpdate !== "function") return sock;
  sock.__addGuard = true;
  const original = sock.groupParticipantsUpdate.bind(sock);

  sock.groupParticipantsUpdate = async (jid, participants, action) => {
    if (action !== "add" || !jid?.endsWith("@g.us")) return original(jid, participants, action);

    const now = Date.now();
    const state = addGuard.get(jid) || { times: [], blockedUntil: 0 };

    if (now < state.blockedUntil) {
      log.warn(`حماية الإغراق: حُجبت محاولة إضافة إلى ${jid} (خلال فترة الحجب).`);
      return [];
    }

    state.times = state.times.filter((t) => now - t <= ADD_GUARD_WINDOW_MS);
    state.times.push(now);
    if (addGuard.size > 1000) addGuard.delete(addGuard.keys().next().value);
    addGuard.set(jid, state);

    if (state.times.length > ADD_GUARD_MAX) {
      state.blockedUntil = now + ADD_GUARD_COOLDOWN_MS;
      state.times = [];
      log.warn(
        `حماية الإغراق: رُصدت ${state.times.length + ADD_GUARD_MAX} محاولات إضافة سريعة إلى ${jid} — حُجبت ${ADD_GUARD_COOLDOWN_MS / 1000}ث.`,
      );
      try {
        await sock.groupSettingUpdate(jid, "announcement");
      } catch (e) {
        log.error(`حماية الإغراق: تعذّر إغلاق المجموعة (${e.message})`);
      }
      return [];
    }

    return original(jid, participants, action);
  };

  return sock;
}

/**
 * يتحقق أن المقبس يستقبل فعلاً بعد "الاتصال".
 *
 * بعد 515 قد يُقبل الاتصال في طبقة WebSocket ويُكمل تسجيل الدخول، لكن الخادم
 * لا يُسلّم أي رسالة (مقبس زومبي). استعلام onWhatsApp يكشف ذلك: على مقبس سليم
 * يعود فوراً، وعلى زومبي لا يعود إطلاقاً.
 */
export async function probeAlive(sock, timeoutMs = ZOMBIE_PROBE_MS) {
  if (typeof sock?.onWhatsApp !== "function") return true;
  const num = String(sock.user?.id || "").split(":")[0].split("@")[0];
  if (!num) return true;
  return Promise.race([
    sock
      .onWhatsApp(num)
      .then(() => true)
      .catch(() => true),
    new Promise((resolve) => {
      const t = setTimeout(() => resolve(false), timeoutMs);
      t.unref?.();
    }),
  ]);
}

const PAIRING_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTVWXYZ";

/** Crockford base32 (بلا I وL وO وU) — سهل القراءة صوتياً ولا يتشابه حرفاه. */
function generatePairingCode() {
  const bytes = randomBytes(8);
  let code = "";
  for (const byte of bytes) code += PAIRING_ALPHABET[byte % PAIRING_ALPHABET.length];
  return code;
}

export async function useSQLiteAuthState(sessionDir) {
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

  const authDb = openDatabase(path.join(sessionDir, "auth.db"));
  authDb.pragma("journal_mode = WAL");
  authDb.exec(`CREATE TABLE IF NOT EXISTS auth (id TEXT PRIMARY KEY, data TEXT)`);

  const readData = (id) => {
    const row = authDb.prepare("SELECT data FROM auth WHERE id = ?").get(id);
    return row ? JSON.parse(row.data, BufferJSON.reviver) : null;
  };

  const writeData = (data, id) => {
    authDb
      .prepare("INSERT OR REPLACE INTO auth (id, data) VALUES (?, ?)")
      .run(id, JSON.stringify(data, BufferJSON.replacer));
  };

  const removeData = (id) => authDb.prepare("DELETE FROM auth WHERE id = ?").run(id);

  const creds = readData("creds") || initAuthCreds();
  // الحفظ فوراً حتى يحمل ملف الجلسة بيانات الاعتماد دائماً، حتى لو لم تصل
  // المصافحة إلى حد إطلاق creds.update.
  writeData(creds, "creds");

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          ids.forEach((id) => {
            let value = readData(`${type}-${id}`);
            if (type === "app-state-sync-key" && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            data[id] = value;
          });
          return data;
        },
        set: async (data) => {
          for (const cat in data) {
            for (const id in data[cat]) {
              const val = data[cat][id];
              if (val) writeData(val, `${cat}-${id}`);
              else removeData(`${cat}-${id}`);
            }
          }
        },
      },
    },
    saveCreds: () => writeData(creds, "creds"),
    closeDb: () => {
      try {
        authDb.close();
      } catch {}
    },
  };
}

export async function clearSocketFiles(sessionDir) {
  try {
    const dbPath = path.join(sessionDir, "auth.db");
    if (fs.existsSync(dbPath)) {
      const db = openDatabase(dbPath);
      const result = db.prepare("DELETE FROM auth WHERE id != 'creds'").run();
      if (result.changes > 0) {
        log.warn(`🗑️ نُظّفت ${result.changes} مفاتيح قديمة من [${path.basename(sessionDir)}]`);
      }
      db.close();
    }
  } catch (e) {
    log.error(`تعذّر تنظيف مفاتيح الجلسة: ${e.message}`);
  }
}

export async function createConnection({
  sessionDir = config.sessionDir,
  botLabel = "MAIN",
  isSubbot = false,
  phoneNumber = null,
  _attempt = 0,
  wipeKeys = false,
  delayBeforeMs = null,
  onOpen = null,
} = {}) {
  await mkdir(sessionDir, { recursive: true });

  // لا تمسح المفاتيح إلا بطلب صريح: بعد الربط مباشرة يُغلق واتساب برمز 515
  // وعلينا إعادة الاتصال *بالمفاتيح* المكتوبة للتو. مسحها في إعادة محاولة عادية
  // يُبقي creds.registered صحيحاً بلا مفاتيح، فيُفتح المقبس دون فك أي تشفير.
  if (_attempt > 0 || delayBeforeMs != null) {
    if (wipeKeys) {
      log.warn(`[${botLabel}] تنظيف مفاتيح الجلسة قبل إعادة الاتصال...`);
      await clearSocketFiles(sessionDir);
    }
    // إعادة الاتصال الفورية بعد 515 تُنتج مقبساً "مفتوحاً" لا يستقبل أي إطار:
    // الخادم لم يُنهِ الجلسة القديمة بعد، فيُسقط الاتصال لاحقاً بـ408.
    // لذا ننتظر ولو قليلاً قبل إعادة الاتصال.
    const delay = delayBeforeMs ?? Math.min(config.reconnectDelay * Math.max(_attempt, 1), 30000);
    if (delay > 0) {
      log.info(`[${botLabel}] إعادة الاتصال بعد ${delay / 1000} ث...`);
      await sleep(delay);
    }
  }

  const { state, saveCreds, closeDb } = await useSQLiteAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  let useCode = false;
  let phone = phoneNumber;

  if (!isSubbot && !state.creds.registered && _attempt === 0 && !phoneNumber) {
    const { method, phone: chosenPhone } = await askPairingDetails();

    if (method === "1") {
      useCode = true;
      phone = chosenPhone;
      if (!phone) {
        log.error("رقم الهاتف مطلوب للاقتران.", "connection.js");
        return;
      }
    } else if (method === null) {
      log.warn("لا إدخال متاح (stdin مغلق) — استخدم رمز QR.");
    }
  }

  let sock;
  let connectionTimeout = null;
  let zombieTimer = null;
  let connected = false;
  const pendingMessages = [];

  const msgStore = new Map();
  const MAX_STORE_SIZE = 500;

  function cacheMessage(msg) {
    if (!msg?.key?.id) return;
    msgStore.set(`${msg.key.remoteJid}:${msg.key.id}`, msg);
    if (msgStore.size > MAX_STORE_SIZE) msgStore.delete(msgStore.keys().next().value);
  }

  function clearConnTimeout() {
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
      connectionTimeout = null;
    }
    if (zombieTimer) {
      clearTimeout(zombieTimer);
      zombieTimer = null;
    }
  }

  async function flushPending() {
    const queue = pendingMessages.splice(0);
    for (const { msg, label } of queue) {
      handleMessage(sock, msg, label).catch((e) =>
        log.error(`[${label}] خطأ في رسالة مؤجلة: ${e.message}`)
      );
    }
  }

  const reconnect = ({ wipe = false, resetAttempt = false, delayBeforeMs = null } = {}) => {
    if (reconnectLocks.has(sessionDir)) return;
    reconnectLocks.add(sessionDir);
    createConnection({
      sessionDir,
      botLabel,
      isSubbot,
      phoneNumber,
      _attempt: resetAttempt ? 0 : _attempt + 1,
      wipeKeys: wipe,
      delayBeforeMs,
      // يُنقل إلى المحاولة التالية، وإلا فُقد تسجيل البوت الرئيسي بعد إعادة الاتصال.
      onOpen,
    })
      .catch((e) => log.error(`[${botLabel}] فشل إعادة الاتصال: ${e.message}`))
      .finally(() => reconnectLocks.delete(sessionDir));
  };

  try {
    sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
      },
      printQRInTerminal: !useCode,
      logger: pino({ level: "silent" }),
      // هوية ثابتة قبل الربط وبعده: تغييرها يُغيّر منصّة الجهاز في حمولة الدخول،
      // فيرى الخادم عميلاً مختلفاً بعد الاقتران ويقطع الاتصال (408 Connection lost).
      browser: ["Ubuntu", "Chrome", "20.0.04"],
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: true,
      connectTimeoutMs: 60000,
      // مُهلة كشف الانقطاع = هذه القيمة + 5ث (الافتراضي في المكتبة 30000).
      keepAliveIntervalMs: 30000,
      retryRequestDelayMs: 3000,
      defaultQueryTimeoutMs: 60000,
      getMessage: async (key) => msgStore.get(`${key.remoteJid}:${key.id}`)?.message || undefined,
    });
  } catch (e) {
    try {
      closeDb();
    } catch {}
    log.error(`[${botLabel}] فشل إنشاء الاتصال: ${e.message}`);
    if (_attempt < config.maxReconnectAttempts) return reconnect({});
    return;
  }

  sock.sessionDir = sessionDir;
  // تُقرأ من messageHandler قبل الإرسال: لا تُرسل على مقبس مغلق.
  sock.isMainBot = !isSubbot;
  attachSocketState(sock);

  const waitingForPairing = useCode && !state.creds.registered;

  if (waitingForPairing && phone) {
    await sleep(PAIRING_DELAY_MS);
    try {
      let code = await sock.requestPairingCode(phone, generatePairingCode());
      // قد تُعيد المكتبة الرمز بواصلة أصلاً؛ نزيلها أولاً حتى لا يُنتج
      // التجميع "ABCD--EFGH".
      code = String(code || "").replace(/[^0-9A-Za-z]/g, "");
      code = code.match(/.{1,4}/g)?.join("-") || code;
      log.pairingCode(code);
    } catch (e) {
      log.error(`[${botLabel}] تعذّر طلب رمز الاقتران: ${e.message}`);
    }
  }

  // لا تُفعّل مهلة الاتصال إلا عندما لا ننتظر رمز اقتران:
  // فبينما يكتب المستخدم الرمز يكون المقبس غير مفتوح بحق، و
  // killing it there is what produced a spurious "انتهت مهلة الاتصال".
  if (!waitingForPairing) {
    connectionTimeout = setTimeout(() => {
      if (!connected) {
        log.warn(`[${botLabel}] انتهت مهلة الاتصال — إعادة المحاولة...`);
        try {
          sock.end(new Error("timeout"));
        } catch {}
      }
    }, CONNECTION_TIMEOUT_MS);
    connectionTimeout.unref?.();
  }

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      log.conn(`[${botLabel}] رمز QR جاهز للمسح`);
      qrcode.generate(qr, { small: true });
    }

    if (connection === "connecting") log.conn(`[${botLabel}] جارٍ الاتصال...`);

    if (connection === "open") {
      clearConnTimeout();
      connected = true;
      sock.markOpen?.();
      log.ok(`[${botLabel}] ✅ متصل → ${sock.user?.id}`);
      // إعادة تسجيل البوت الرئيسي عند كل فتح: بعد إعادة الاتصال ينشأ مقبس جديد
      // ولا يعود getMainSock() إليه، فيُعرَض البوت الرئيسي خطأً كبوت فرعي.
      try {
        onOpen?.(sock);
      } catch (e) {
        log.error(`[${botLabel}] خطأ في onOpen: ${e.message}`);
      }
      await flushPending();

      // المقبس الزومبي: "متصل" لكنه لا يستقبل أي رسالة. نفحص باستعلام خفيف
      // ونُعيد الاتصال فوراً إن لم يستجب — فلا ننتظر 408 بعد ~50 ثانية.
      clearTimeout(zombieTimer);
      zombieTimer = setTimeout(() => {
        if (!connected || sock.isOpen === false) return;
        probeAlive(sock).then((alive) => {
          if (alive || !connected || sock.isOpen === false) return;
          log.warn(`[${botLabel}] لا استجابة من الخادم بعد الاتصال — إعادة الاتصال...`);
          // نُوسم الخطأ بـ515 حتى يسلك مسار إعادة التشغيل السريع بميزانية جديدة.
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
      clearConnTimeout();
      connected = false;
      sock.markClosed?.();
      const code = lastDisconnect?.error?.output?.statusCode;
      const reason = lastDisconnect?.error?.message || "غير معروف";
      log.warn(`[${botLabel}] ❌ انقطع الاتصال → الرمز: ${code} | ${reason}`);

      if (code === DisconnectReason.loggedOut) {
        log.error(
          `[${botLabel}] تم تسجيل الخروج. احذف "auth.db" من مجلد "${path.basename(sessionDir)}" وأعد التشغيل.`
        );
        try {
          closeDb();
        } catch {}
        return;
      }

      if (code === DisconnectReason.connectionReplaced) {
        log.error(`[${botLabel}] تم استبدال الجلسة بأخرى. الإيقاف.`);
        try {
          closeDb();
        } catch {}
        return;
      }

      try {
        closeDb();
      } catch {}

      if (code === DisconnectReason.badSession) {
        log.error(`[${botLabel}] جلسة تالفة — تنظيف وإعادة الاتصال...`);
        return reconnect({ wipe: true });
      }

      // يصل 515 بعد ربط ناجح مباشرة: أعد الاتصال بالجلسة المحفوظة
      // وابدأ ميزانية المحاولات من جديد.
      if (code === DisconnectReason.restartRequired) {
        log.info(`[${botLabel}] إعادة تشغيل مطلوبة — إعادة الاتصال بالجلسة المحفوظة...`);
        // مهلة قصيرة إلزامية: إعادة الاتصال الفورية بعد 515 تُنتج مقبساً
        // "مفتوحاً" لا يستقبل رسائل (زومبي) يُسقَط لاحقاً بـ408.
        return reconnect({ resetAttempt: true, delayBeforeMs: RESTART_DELAY_MS });
      }

      if (_attempt < config.maxReconnectAttempts) {
        log.info(`[${botLabel}] إعادة الاتصال (${_attempt + 1}/${config.maxReconnectAttempts})...`);
        reconnect({});
      } else {
        log.error(`[${botLabel}] استُنفدت محاولات إعادة الاتصال.`);
      }
    }
  });

  sock.ev.on("CB:stream:error", (err) => {
    log.error(`[${botLabel}] خطأ في التدفق: ${err?.message || err}`);
  });

  sock.ws?.on?.("error", (err) => {
    log.error(`[${botLabel}] خطأ في WebSocket: ${err?.message || err}`);
  });

  sock.ev.on("creds.update", saveCreds);

  registerGroupCacheEvents(sock);
  registerAntifeatures(sock, botLabel);
  // يضيف sock.sendButtonMessage — انظر core/buttons.js.
  initButtons(sock);
  // انتظار إعادة الفتح + محاولة ثانية عند 428 بدل إسقاط الأمر.
  makeSendResilient(sock);
  // حجب رشقات الإضافة الصادرة (يمنع استخدام البوت أداةَ إغراق).
  guardGroupAddFlood(sock);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message) continue;
      if (msg.key?.remoteJid === "status@broadcast") continue;
      // مجموعات فقط: لا تُخزَّن ولا تُعالَج رسائل الخاص إطلاقاً.
      if (config.groupsOnly && !msg.key?.remoteJid?.endsWith("@g.us")) continue;

      cacheMessage(msg);

      // لا تُعالَج رسالة على مقبس أُغلق للتو: الإرسال عليه يفشل بـ428
      // "Connection Closed" (يحدث أثناء إعادة الاتصال بعد الربط).
      if (!connected || sock.isOpen === false) {
        pendingMessages.push({ msg, label: botLabel });
        continue;
      }

      handleMessage(sock, msg, botLabel).catch((e) =>
        log.error(`[${botLabel}] خطأ في رسالة: ${e.message}`)
      );
    }
  });

  return sock;
}
