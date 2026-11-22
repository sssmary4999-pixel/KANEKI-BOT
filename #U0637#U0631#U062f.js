import config from '../../Corleone/settings.js'

function cleanJid(jid = "") {
  if (!jid) return "";
  const atIndex = jid.lastIndexOf("@");
  if (atIndex === -1) return jid.split(":")[0];
  const userPart = jid.slice(0, atIndex).split(":")[0];
  const domainPart = jid.slice(atIndex + 1);
  return `${userPart}@${domainPart}`;
}

export default {
  name: ["طرد"],
  description: 'يطرد عضواً من المجموعة',
  category: "المجموعات",
  groupOnly: true,
  botAdmin: true,
  adminOnly: true,

  async run({ sock, from, msg, groupMeta, clearGroupCache, reply }) {

    const participants = groupMeta?.participants || []

    const contextInfo = msg.message?.extendedTextMessage?.contextInfo || msg.message?.imageMessage?.contextInfo || msg.message?.videoMessage?.contextInfo
    const mentioned = contextInfo?.mentionedJid || []

    let targetRaw = contextInfo?.participantAlt || contextInfo?.participant || mentioned[0]
    if (!targetRaw) return await reply({ text: ( `❌ اذكر المستخدم المراد طرده أو ردّ عليه.`) })

    const cleanTarget = targetRaw.split(':')[0]

    let targetJid = cleanJid(cleanTarget)
    if (cleanTarget.endsWith('@lid')) {
      const match = participants.find(p => p.lid === cleanTarget)
      if (match) targetJid = cleanJid(match.id)
    }

    const botJid = cleanJid(sock.user?.id)
    if (targetJid === botJid) return await reply({ text: ( `❌ لا يمكنك طردي أنا.`) })

    // 🔧 تصفية المالكين والشركاء
    const targetNumber = targetJid.split('@')[0]
    const owners = [...(config.ownerNumber || []), ...(config.coOwners || [])]
    if (owners.includes(targetNumber)) return await reply({ text: ( `❌ لا يمكنني طرد مالك البوت.`) })

    const targetParticipant = participants.find(p => cleanJid(p.id) === targetJid)
    if (targetParticipant?.admin === 'superadmin') return await reply({ text: ( `❌ لا يمكنني طرد منشئ المجموعة.`) })
    if (targetParticipant?.admin === 'admin') return await reply({ text: ( `❌ لا يمكنني طرد مشرف.`) })

    await sock.groupParticipantsUpdate(from, [targetJid], "remove")
    clearGroupCache()
  }
}