import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { WAMessageStubType } from "@whiskeysockets/baileys";
import { log } from "../logger.js";
import { db } from "../../database/db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** كل ملف .js في core/مضاد/ (عدا هذا الملف) هو مضاد مستقل. */
async function loadModules() {
  const modules = [];

  let files;
  try {
    files = readdirSync(__dirname).filter((f) => f.endsWith(".js") && f !== "index.js");
  } catch (e) {
    log.warn(`تعذّر قراءة مجلد المضادات: ${e.message}`);
    return modules;
  }

  for (const file of files) {
    try {
      const mod = await import(pathToFileURL(join(__dirname, file)).href);
      if (!mod.default?.name) {
        log.warn(`المضاد ${file} لا يصدّر default بـ name.`);
        continue;
      }
      modules.push(mod.default);
    } catch (e) {
      log.warn(`تعذّر تحميل المضاد ${file}: ${e.message}`);
    }
  }

  return modules;
}

const modules = await loadModules();

function cleanJid(jid = "") {
  if (!jid) return "";
  const at = jid.lastIndexOf("@");
  if (at === -1) return jid.split(":")[0];
  return `${jid.slice(0, at).split(":")[0]}@${jid.slice(at + 1)}`;
}

/** الرقم المجرّد من معرّف أو مقبس: "123:5@s.whatsapp.net" -> "123". */
function numOf(jid = "") {
  return String(jid).split("@")[0].split(":")[0];
}

/** هل البوت مشرف في هذه المجموعة؟ */
async function isBotAdminIn(sock, groupJid) {
  try {
    const meta = await sock.groupMetadata(groupJid);
    const bot = cleanJid(sock.user?.id || "");
    const botNum = bot.split("@")[0];
    const p = meta?.participants?.find((x) => {
      const id = cleanJid(x.id || "");
      return id === bot || id.split("@")[0] === botNum;
    });
    return p?.admin === "admin" || p?.admin === "superadmin";
  } catch {
    return false;
  }
}

/**
 * يمرّر الرسالة على المضادات المطابقة للفلتر.
 * يعيد true إذا تعامل أحدها مع الرسالة (فلا تُعالج كأمر).
 */
async function runMods(filterFn, { sock, msg, from, sender, body, isBotAdmin, isAdmin, isOwner, isMod, botLabel, isCmd }) {
  const groupData = db.getGroup(from);
  const botSettings = db.getBotSettings(numOf(sock.user?.id));

  for (const mod of modules) {
    if (!mod.check || !filterFn(mod)) continue;
    if (mod.flag && !(mod.global ? botSettings[mod.flag] : groupData?.[mod.flag])) continue;

    try {
      const handled = await mod.check({ sock, msg, from, sender, body, isBotAdmin, isAdmin, isOwner, isMod, botLabel, isCmd });
      if (handled) return true;
    } catch (e) {
      log.error(`خطأ في ${mod.name}: ${e.message}`);
    }
  }

  return false;
}

/** مضادات الحماية: تستهدف المخالفين، فلا تُشغَّل للمشرفين. */
export async function runAntifeatures(ctx) {
  return runMods((m) => !m.allUsers, ctx);
}

/** مضادات تعمل لكل الأعضاء بلا استثناء (رفع المستوى التلقائي). */
export async function runAllUsersAntifeatures(ctx) {
  return runMods((m) => !!m.allUsers, ctx);
}

/**
 * يربط أحداث الدخول والخروج والحذف بكل مضاد يملك onJoin/onLeave/onDelete.
 * كل معالج معزول بـ try/catch حتى لا يُسقط خطأ واحد البوت.
 */
export function registerAntifeatures(sock, botLabel = "MAIN") {
  // ذاكرة الرسائل الأصلية لاسترجاعها عند الحذف. المكتبة تحذف حمولة الرسالة من
  // الحدث (تُبقي المفتاح فقط)، ولا تُصدّر ذاكرتها الداخلية، فنُبقي نسخة هنا.
  const messageCache = new Map();
  const MAX_CACHE_SIZE = 1000;

  sock.ev.on("messages.upsert", ({ messages }) => {
    for (const msg of messages || []) {
      if (!msg?.key?.id) continue;
      messageCache.set(msg.key.id, msg);
      if (messageCache.size > MAX_CACHE_SIZE) messageCache.delete(messageCache.keys().next().value);
    }
  });

  // حالات واتساب (status@broadcast) لا تخص مجموعة، فتُمرَّر للمضادات العامة وحدها.
  // إعداداتها خاصة برقم البوت نفسه، فيتحكم كل بوت في مشاهدة حالاته مستقلاً.
  sock.ev.on("messages.upsert", async ({ messages }) => {
    if (!Array.isArray(messages)) return;

    const statuses = messages.filter((m) => m?.key?.remoteJid === "status@broadcast");
    if (!statuses.length) return;

    const botSettings = db.getBotSettings(numOf(sock.user?.id));
    const mods = modules.filter((m) => m.global && m.onStatus && (!m.flag || botSettings[m.flag]));
    if (!mods.length) return;

    for (const msg of statuses) {
      for (const mod of mods) {
        try {
          await mod.onStatus({ sock, msg, botLabel });
        } catch (e) {
          log.error(`خطأ في ${mod.name}: ${e.message}`);
        }
      }
    }
  });

  sock.ev.on("group-participants.update", async ({ id, participants, action, author, authorPn, authorUsername }) => {
    if (!id?.endsWith("@g.us") || !Array.isArray(participants)) return;

    try {
      const groupData = db.getGroup(id);
      const isBotAdmin = await isBotAdminIn(sock, id);

      for (const mod of modules) {
        if (mod.flag && !groupData?.[mod.flag]) continue;

        const fn =
          action === "add" ? mod.onJoin :
          action === "remove" ? mod.onLeave :
          action === "promote" ? mod.onPromote :
          action === "demote" ? mod.onDemote :
          null;
        if (!fn) continue;

        try {
          await fn({ sock, groupJid: id, participants, isBotAdmin, botLabel, actor: author, actorPn: authorPn, actorUsername: authorUsername });
        } catch (e) {
          log.error(`خطأ في ${mod.name}: ${e.message}`);
        }
      }
    } catch (e) {
      log.error(`[${botLabel}] خطأ في حدث المشاركين: ${e.message}`);
    }
  });

  // تغييرات بيانات المجموعة (الاسم، الوصف، الإعدادات). الجرد الجماعي يبثّ البيانات
  // كاملة بلا `author`، فيتجاهله المضاد الذي يميّز التغيير الحقيقي بالفاعل.
  sock.ev.on("groups.update", async (updates) => {
    if (!Array.isArray(updates)) return;

    for (const update of updates) {
      const groupJid = update?.id;
      if (!groupJid?.endsWith("@g.us")) continue;

      try {
        const groupData = db.getGroup(groupJid);
        for (const mod of modules) {
          if (!mod.onGroupUpdate) continue;
          if (mod.flag && !groupData?.[mod.flag]) continue;

          try {
            await mod.onGroupUpdate({ sock, groupJid, update, botLabel });
          } catch (e) {
            log.error(`خطأ في ${mod.name}: ${e.message}`);
          }
        }
      } catch (e) {
        log.error(`[${botLabel}] خطأ في حدث المجموعة: ${e.message}`);
      }
    }
  });

  // الحذف يصل كتحديث بروتوكول REVOKE. المكتبة توفّر `message.deleted` عند تفعيل
  // vaultOptions، لكنه يتطلب خيارات إنشاء المقبس؛ نستمع للتحديث الخام هنا ليعمل
  // في كل المقابس بلا شرط. الرسالة الأصلية تُجلب من الذاكرة عبر WAMessage.key.
  sock.ev.on("messages.update", async (updates) => {
    if (!Array.isArray(updates)) return;

    for (const update of updates) {
      if (update?.update?.messageStubType !== WAMessageStubType.REVOKE) continue;

      const original = update.update.key;
      const from = original?.remoteJid || update.key?.remoteJid || "";
      if (!from.endsWith("@g.us") || !original?.id) continue;

      try {
        const groupData = db.getGroup(from);
        for (const mod of modules) {
          if (!mod.onDelete) continue;
          if (mod.flag && !groupData?.[mod.flag]) continue;

          try {
            const deleted = messageCache.get(original.id);
            if (!deleted) continue;
            await mod.onDelete({ sock, deleted, botLabel });
          } catch (e) {
            log.error(`خطأ في ${mod.name}: ${e.message}`);
          }
        }
      } catch (e) {
        log.error(`[${botLabel}] خطأ في حدث الحذف: ${e.message}`);
      }
    }
  });

  log.info(`[${botLabel}] المضادات مُفعّلة: ${modules.map((m) => m.name).join("، ")}`);
}

/** سجل المضادات: يُستخدم بواسطة أمر التحكم الواحد في plugins/. */
export const antifeatures = modules.map((m) => ({
  name: m.name,
  flag: m.flag,
  global: !!m.global,
  mode: m.mode || null,
}));
/** الوحدات الخام: للدوالّ الاختيارية (status/button/run) في لوحة التحكم. */
export const antifeatureModules = modules;
export const antifeatureNames = modules.map((m) => m.name);
