import { xpProgress } from "../../Corleone/xp.js";
import { db } from "../../database/db.js";

const FALLBACK_PHOTO = "https://cdn.dix.lat/me/0b0v_20260828-c91x-qz9u-550c.jpg";

function cleanJid(jid = "") {
  if (!jid) return "";
  const atIndex = jid.lastIndexOf("@");
  if (atIndex === -1) return jid.split(":")[0];
  const userPart = jid.slice(0, atIndex).split(":")[0];
  const domainPart = jid.slice(atIndex + 1);
  return `${userPart}@${domainPart}`;
}

function labelPorGenero(jid) {
  const genero = (db.getGenero(jid) || "").toLowerCase();
  if (genero === "ذكر") return "زوج";
  if (genero === "أنثى") return "زوجة";
  return "زوج/زوجة";
}

function labelSoltero(jid) {
  const genero = (db.getGenero(jid) || "").toLowerCase();
  if (genero === "ذكر") return "أعزب";
  if (genero === "أنثى") return "عزباء";
  return "أعزب/عزباء";
}

export default {
  name: ["ملفي"],
  description: "يعرض ملفك الشخصي: الصورة والعملات والخبرة",
  category: "المعلومات",

  async run({ sock, sender, from, msg, groupMeta, resolveLid, reply }) {

    const contextInfo = msg?.message?.extendedTextMessage?.contextInfo;

    let targetJid = null;
    if (contextInfo?.mentionedJid?.length > 0) {
      targetJid = contextInfo.mentionedJid[0];
    } else if (contextInfo?.participant) {
      targetJid = contextInfo.participant;
    }

    let target = sender;
    if (targetJid) {
      if (targetJid.endsWith("@lid") || isNaN(targetJid.split("@")[0])) {
        const found = groupMeta?.participants?.find((p) => p.id === targetJid || p.lid === targetJid);
        if (found?.id) targetJid = found.id;
      }
      if (targetJid.endsWith("@lid")) {
        targetJid = await resolveLid(targetJid);
      }
      target = cleanJid(targetJid);
    }

    const user = db.getUser(target);
    const eco = db.getEco(target);
    const partner = db.getMarriage(target);
    const { level, xp, missing } = xpProgress(user.xp || 0);

    let photoUrl = FALLBACK_PHOTO;
    try {
      photoUrl = await sock.profilePictureUrl(target, "image");
    } catch {
      // بلا صورة أو خصوصية مقيّدة: تُستخدم الصورة الاحتياطية
    }

    const total = eco.bolsillo + eco.banco;
    const mention = `@${target.split("@")[0]}`;

    const parejaLine = partner
      ? `𓂃ෆ˚ 💍 ${labelPorGenero(partner)}: @${partner.split("@")[0]} ˃͈◡˂͈\n`
      : `𓂃ෆ˚ 💔 ${( "الحالة")}: ${labelSoltero(target)}\n`;

    const caption =
      ( `𓂃ෆ˚ 🍮 ملف ${mention} ౨ৎ\n\n`) +
      ( `𓂃ෆ˚ 🍮 العملات ${total} [المحفظة: ${eco.bolsillo} | البنك: ${eco.banco}]\n`) +
      ( `⏤͟͟͞͞  ⚡ المستوى: ${level}\n`) +
      parejaLine +
      ( `𓂃ෆ˚ *الخبرة:* ${xp} [المتبقي ${missing} للمستوى ${level + 1}]`);

    const mentions = partner ? [target, partner] : [target];

    try {
      await sock.sendMessage(
        from,
        { image: { url: photoUrl }, caption, mentions },
        { quoted: msg }
      );
    } catch (error) {
      await reply({ text: ( `خطأ في عرض الملف الشخصي: ${error.message}`) });
      console.error(( "خطأ في الملف الشخصي:"), error);
    }
  }
};