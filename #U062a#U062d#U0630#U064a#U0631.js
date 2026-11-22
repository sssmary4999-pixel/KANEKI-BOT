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
  name: ["تحذير"],
  description: 'ينبّه عضواً في المجموعة',
  category: "المجموعات",
  groupOnly: true,
  adminOnly: true,

  async run({ sock, from, msg, groupMeta, args, reply }) {

    try {
      const participants = groupMeta?.participants || []

      const contextInfo = msg.message?.extendedTextMessage?.contextInfo || msg.message?.imageMessage?.contextInfo || msg.message?.videoMessage?.contextInfo
      const mentioned = contextInfo?.mentionedJid || []

      let targetRaw = contextInfo?.participantAlt || contextInfo?.participant || mentioned[0]
      if (!targetRaw) return await reply({ text: ( `⚠️ اذكر المستخدم الذي تريد تحذيره أو ردّ عليه.`) })

      const cleanTarget = targetRaw.split(':')[0]
      let targetJid = cleanJid(cleanTarget)
      if (cleanTarget.endsWith('@lid')) {
        const match = participants.find(p => p.lid === cleanTarget)
        if (match) targetJid = cleanJid(match.id)
      }

      const targetParticipant = participants.find(p => cleanJid(p.id) === targetJid)
      if (targetParticipant?.admin === 'admin' || targetParticipant?.admin === 'superadmin') {
        return await reply({ text: ( `❌ لا يمكنك تحذير مشرف آخر.`) })
      }

      const groupData = db.getGroup(from) || {}
      const currentWarns = groupData.warns || {}
      if (!currentWarns[targetJid]) currentWarns[targetJid] = []

      const adminName = msg.pushName || "Admin"
      const razon = args.join(" ") || ( "لم يُحدَّد سبب.")
      const targetNum = targetJid.split('@')[0]

      currentWarns[targetJid].push({
        razon,
        fecha: new Date().toLocaleDateString("es-CO"),
        by: adminName,
        targetNum: targetNum
      })

      db.setGroup(from, { ...groupData, warns: currentWarns })

      const totalWarns = currentWarns[targetJid].length
      const willKick = totalWarns >= 3

      let texto = ( `⚠️ *تم تحذير المستخدم!* ⚠️\n\n`)
      texto += ( `👤 *المستخدم:* @${targetNum}\n`)
      texto += `👮‍♂️ *بواسطة:* ${adminName}\n`
      texto += `📝 *السبب:* ${razon}\n`
      texto += `📊 *التحذيرات:* ${totalWarns}/3\n\n`

      if (willKick) {
        texto += ( `❗ *وصل هذا المستخدم إلى حد 3 تحذيرات وسيُطرد من المجموعة.*`)
      }

      await sock.sendMessage(from, {
        text: texto,
        mentions: [targetJid]
      }, { quoted: msg })

      if (willKick) {
        try {
          const botJid = cleanJid(sock.user?.id || "")
          const botLid = sock.user?.lid ? cleanJid(sock.user.lid) : null
          const botParticipant = participants.find(p =>
            cleanJid(p.id) === botJid ||
            (botLid && cleanJid(p.id) === botLid) ||
            (p.lid && cleanJid(p.lid) === botJid) ||
            (p.lid && botLid && cleanJid(p.lid) === botLid)
          )
          const botIsAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin'

          if (!botIsAdmin) {
            await reply({ text: ( `⚠️ لم أستطع طرد @${targetNum} لأنني لا أملك صلاحيات المشرف.`), mentions: [targetJid] })
          } else {
            await sock.groupParticipantsUpdate(from, [targetJid], 'remove')
            currentWarns[targetJid] = []
            db.setGroup(from, { ...groupData, warns: currentWarns })
            await reply({ text: ( `👢 طُرد @${targetNum} من المجموعة بعد 3 تحذيرات.`), mentions: [targetJid] })
          }
        } catch (kickErr) {
          console.error(( "خطأ أثناء الطرد بعد 3 تحذيرات:"), kickErr)
          await reply({ text: ( `⚠️ لم أستطع طرد @${targetNum} (تحقق من صلاحياتي كمشرف).`), mentions: [targetJid] })
        }
      }

    } catch (err) {
      console.error(( "خطأ في أمر warn:"), err)
      await reply({ text: ( "❌ حدث خطأ داخلي أثناء تنفيذ الأمر.") })
    }
  }
}
