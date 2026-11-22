function cleanJid(jid = "") {
  if (!jid) return "";
  const atIndex = jid.lastIndexOf("@");
  if (atIndex === -1) return jid.split(":")[0];
  const userPart = jid.slice(0, atIndex).split(":")[0];
  const domainPart = jid.slice(atIndex + 1);
  return `${userPart}@${domainPart}`;
}

export default {
  name: ["ترقية"],
  description: 'يرقّي عضواً إلى مشرف',
  category: "المجموعات",
  groupOnly: true,
  botAdmin: true,
  adminOnly: true,

  async run({ sock, from, msg, groupMeta, clearGroupCache, reply, senderNum, sender }) {

    const participants = groupMeta?.participants || []

    const contextInfo = msg.message?.extendedTextMessage?.contextInfo || msg.message?.imageMessage?.contextInfo || msg.message?.videoMessage?.contextInfo
    const mentioned = contextInfo?.mentionedJid || []

    let targetRaw = contextInfo?.participantAlt || contextInfo?.participant || mentioned[0]
    if (!targetRaw) return await reply({ text: ( `❌ اذكر المستخدم لمنحه الإشراف أو ردّ عليه.`) })

    const cleanTarget = targetRaw.split(':')[0]
    let targetJid = cleanJid(cleanTarget)
    if (cleanTarget.endsWith('@lid')) {
      const match = participants.find(p => p.lid === cleanTarget)
      if (match) targetJid = cleanJid(match.id)
    }

    const targetParticipant = participants.find(p => cleanJid(p.id) === targetJid)
    if (targetParticipant?.admin === 'admin' || targetParticipant?.admin === 'superadmin') {
      return await reply({ text: ( `❌ هذا المستخدم مشرف بالفعل.`) })
    }

    await sock.groupParticipantsUpdate(from, [targetJid], "promote")
    clearGroupCache()

    const targetNum = targetJid.split('@')[0]
    let textoPromote = `│✐꒷★ @${targetNum} تمّت ترقيته إلى مشرف.\n`
    textoPromote += ( `> نُفّذ بواسطة @${senderNum}`)

    await sock.sendMessage(from, {
      text: textoPromote,
      contextInfo: { mentionedJid: [targetJid, sender] }
    }, { quoted: msg })
  }
}