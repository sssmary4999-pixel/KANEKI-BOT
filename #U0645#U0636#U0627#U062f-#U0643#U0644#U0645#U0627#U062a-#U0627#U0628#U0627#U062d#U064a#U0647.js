import { log } from "../logger.js";
import config from "../settings.js";
import { addWarning, clearWarnings, MAX_WARNINGS } from "../warnings.js";

const numOf = (jid = "") => String(jid).split("@")[0].split(":")[0];

// كلمات إباحية/بذيئة شائعة. تُطابَق كجذر داخل الكلمة بعد التنظيف.
const BAD_WORDS = [
  "شرموط", "شرموطه", "قحبه", "قحبة", "عاهر", "عاهره", "زانيه", "زانية",
  "كس", "طيز", "زب", "نيك", "منيك", "متناك", "ديوث", "خرا", "خراء",
  "زباله", "زبالة", "حمار", "كلب", "خنزير", "قذر", "لعنة", "يلعن",
  "fuck", "fuckyou", "bitch", "pussy", "dick", "cock", "whore", "slut",
  "motherfucker", "asshole", "nigger",
];

/** يزيل التشكيل والتطويل ويوحّد الألف/الياء/الهاء، ثم يصغّر النص. */
function normalize(text = "") {
  return String(text)
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[أإآا]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase();
}

function hasBadWord(text = "") {
  const t = normalize(text);
  return BAD_WORDS.some((w) => t.includes(normalize(w)));
}

function ownerNumbers() {
  return [config.ownerNumber, config.coOwners]
    .flat()
    .filter(Boolean)
    .map((n) => numOf(String(n)));
}

export default {
  name: "مضاد-كلمات-اباحيه",
  flag: "antibadword",

  // ثلاث تحذيرات (يحذف الرسالة في كل مرة)، ثم طرد.
  async check({ sock, msg, from, sender, body, isBotAdmin, isAdmin, isOwner, isMod, botLabel }) {
    if (!body || !hasBadWord(body)) return false;

    // استثناءات: البوت نفسه، المالك، مشرف المجموعة، عائلة الإشراف.
    if (numOf(sender) === numOf(sock.user?.id)) return false;
    if (isOwner || isAdmin || isMod) return false;
    if (ownerNumbers().includes(numOf(sender))) return false;

    const user = numOf(sender);

    // حذف الرسالة في كل مخالفة (حتى قبل اكتمال التحذيرات).
    try {
      await sock.sendMessage(from, {
        delete: { remoteJid: from, id: msg.key.id, participant: sender, fromMe: false },
      });
    } catch (e) {
      log.warn(`مضاد الكلمات الإباحية: تعذّر الحذف (${e.message})`);
    }

    const count = addWarning("antibadword", from, sender);

    try {
      if (count < MAX_WARNINGS) {
        await sock.sendMessage(from, {
          text: `⚠️ *تحذير ${count}/${MAX_WARNINGS}*\n> @${user} يُمنع الكلام الإباحي في المجموعة.`,
          mentions: [sender],
        });
        log.cmdExec({ cmdName: "antibadword-warn", sender: user, botLabel });
        return true;
      }

      clearWarnings("antibadword", from, sender);

      if (isBotAdmin) {
        await sock.groupParticipantsUpdate(from, [sender], "remove");
        await sock.sendMessage(from, {
          text: `🚫 *مضاد الكلمات الإباحية*\n> استُنفدت التحذيرات (${MAX_WARNINGS})، وطُرد @${user}.`,
          mentions: [sender],
        });
        log.cmdExec({ cmdName: "antibadword-kick", sender: user, botLabel });
      } else {
        await sock.sendMessage(from, {
          text: `⚠️ *مضاد الكلمات الإباحية*\n> استُنفدت التحذيرات (${MAX_WARNINGS}) لـ @${user}، لكنني لست مشرفاً لطرده.`,
          mentions: [sender],
        });
      }
    } catch (e) {
      log.error(`مضاد الكلمات الإباحية: ${e.message}`);
    }

    return true;
  },
};
