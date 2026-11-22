import { log } from "../logger.js";
import { db } from "../../database/db.js";

// Baileys يمرّر المشاركين كائنات { id, ... } لا نصوصاً.
function jidOf(p) {
  if (!p) return "";
  if (typeof p === "string") return p;
  return p.id || p.jid || p.participant || p.participantAlt || "";
}

const numOf = (jid = "") => String(jid).split("@")[0].split(":")[0];

/** رقم يبدو حساباً آلياً: قصير جداً أو فيه تكرار غير طبيعي. */
function looksLikeBot(jid = "") {
  const num = numOf(jid);
  if (!/^\d+$/.test(num)) return false;
  if (num.length < 8) return true;
  if (/^(\d)\1{5,}$/.test(num)) return true;
  return false;
}

/**
 * معرّفات بوتاتنا (الرئيسي والفرعية): أرقامها و lid الخاصة بها.
 * تُجمع من قاعدة البيانات (كل الأرقام المسجّلة) ومن المقبس الحالي.
 */
function ourBotIds(sock) {
  const ids = new Set();

  const add = (v) => {
    if (!v) return;
    const s = String(v);
    if (s.includes("@")) ids.add(s);
    const n = numOf(s);
    if (n) ids.add(n);
  };

  try {
    for (const bot of db.getAllBots()) {
      add(bot.jid);
      add(bot.lid);
    }
  } catch {}

  add(sock?.user?.id);
  add(sock?.user?.lid);

  return ids;
}

/** هل هذا المشارك أحد بوتاتنا؟ يُطابق بالرقم أو بـ lid. */
function isOurBot(jid, ids) {
  if (!jid) return false;
  if (ids.has(String(jid))) return true;
  return ids.has(numOf(jid));
}

export default {
  name: "مضاد-بوتات",
  flag: "antibot",

  async onJoin({ sock, groupJid, participants, isBotAdmin, botLabel }) {
    if (!isBotAdmin) return;

    // بوتاتنا (الرئيسي والفرعية) تعرف نفسها: لا تُطرد أبداً.
    const ids = ourBotIds(sock);

    for (const p of participants) {
      const jid = jidOf(p);
      if (!jid || !looksLikeBot(jid)) continue;
      if (isOurBot(jid, ids)) continue;

      try {
        await sock.groupParticipantsUpdate(groupJid, [jid], "remove");
        await sock.sendMessage(groupJid, {
          text: `🤖 *مضاد البوتات*\n> طُرد حساب مشبوه: @${numOf(jid)}`,
          mentions: [jid],
        });
        log.info(`[${botLabel}] مضاد البوتات: طُرد ${jid} من ${groupJid}`);
      } catch (e) {
        log.error(`مضاد البوتات: ${e.message}`);
      }
    }
  },
};
