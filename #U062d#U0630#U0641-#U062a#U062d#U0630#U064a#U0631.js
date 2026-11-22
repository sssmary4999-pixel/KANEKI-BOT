import { db } from "../../database/db.js";

function cleanJid(jid = "") {
  if (!jid) return "";
  const atIndex = jid.lastIndexOf("@");
  if (atIndex === -1) return jid.split(":")[0];
  const userPart = jid.slice(0, atIndex).split(":")[0];
  const domainPart = jid.slice(atIndex + 1);
  return `${userPart}@${domainPart}`;
}

export default {
  name: ["حذف-تحذير"],
  description: 'يزيل تحذيراً من عضو في المجموعة',
  category: "المجموعات",
  groupOnly: true,
  adminOnly: true,

  async run({ sock, from, msg, groupMeta, reply }) {

    try {
      const participants = groupMeta?.participants || []

      const contextInfo = msg.message?.extendedTextMessage?.contextInfo || msg.message?.imageMessage?.contextInfo || msg.message?.videoMessage?.contextInfo
      const mentioned = contextInfo?.mentionedJid || []

      let targetRaw = contextInfo?.participantAlt || contextInfo?.participant || mentioned[0]
      if (!targetRaw) return await reply({ text: ( `⚠️ اذكر المستخدم أو ردّ عليه لإزالة تحذير.`) })

      const cleanTarget = targetRaw.split(':')[0]
      let targetJid = cleanJid(cleanTarget)
      if (cleanTarget.endsWith('@lid')) {
        const match = participants.find(p => p.lid === cleanTarget)
        if (match) targetJid = cleanJid(match.id)
      }

      const groupData = db.getGroup(from) || {}
      const currentWarns = groupData.warns || {}
      const userWarns = currentWarns[targetJid] || []

      if (userWarns.length === 0) {
        return await sock.sendMessage(from, {
          text: ( `👤 المستخدم @${targetJid.split('@')[0]} ليس لديه تحذيرات نشطة في هذه المجموعة.`),
          mentions: [targetJid]
        }, { quoted: msg })
      }

      userWarns.pop()
      currentWarns[targetJid] = userWarns
      db.setGroup(from, { ...groupData, warns: currentWarns })

      await sock.sendMessage(from, {
        text: ( `✅ أُزيل تحذير من @${targetJid.split('@')[0]}.\n📊 *التحذيرات المتبقية:* ${userWarns.length}/3`),
        mentions: [targetJid]
      }, { quoted: msg })

    } catch (err) {
      console.error(( "خطأ في أمر delwarn:"), err)
      await reply({ text: ( "❌ حدث خطأ داخلي أثناء تنفيذ الأمر.") })
    }
  }
}