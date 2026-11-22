import { db } from '../../database/db.js'

function cleanJid(jid = '') {
  if (!jid) return ''
  const atIndex = jid.lastIndexOf('@')
  if (atIndex === -1) return jid.split(':')[0]
  const userPart = jid.slice(0, atIndex).split(':')[0]
  const domainPart = jid.slice(atIndex + 1)
  return `${userPart}@${domainPart}`
}

export default {
  name: ["تحويل"],
  description: 'يتبرّع بالشظايا من محفظتك لشخص آخر',
  category: "الاقتصاد",
  ownerOnly: false,

  async run({ sender, args, msg, groupMeta, resolveLid, reply, react }) {

    const contextInfo = msg?.message?.extendedTextMessage?.contextInfo

    let targetJid = null
    if (contextInfo?.mentionedJid?.length > 0) {
      targetJid = contextInfo.mentionedJid[0]
    } else if (contextInfo?.participant) {
      targetJid = contextInfo.participant
    }

    if (!targetJid) {
      return await reply({ text: ( `⚠️ اذكر شخصاً أو ردّ على رسالته.\n\n*مثال:* .تحويل @مستخدم 500`) })
    }

    if (targetJid.endsWith('@lid') || isNaN(targetJid.split('@')[0])) {
      const found = groupMeta?.participants?.find((p) => p.id === targetJid || p.lid === targetJid)
      if (found?.id) targetJid = found.id
    }

    if (targetJid.endsWith('@lid')) {
      targetJid = await resolveLid(targetJid)
    }

    const target = cleanJid(targetJid)

    if (target === sender) {
      return await reply({ text: ( `❌ لا يمكنك التبرع بالشظايا لنفسك.`) })
    }

    // المبلغ هو أول وسيط رقمي/all، بغضّ النظر عن موضع @الإشارة
    const rawArg = args.find((a) => a.toLowerCase() === 'all' || a.toLowerCase() === 'الكل' || !isNaN(parseInt(a)))
    const senderEco = db.getEco(sender)

    let cantidad
    if (rawArg?.toLowerCase() === 'all' || rawArg?.toLowerCase() === 'الكل') {
      cantidad = senderEco.bolsillo
    } else {
      cantidad = parseInt(rawArg)
    }

    if (!cantidad || isNaN(cantidad) || cantidad <= 0) {
      return await reply({ text: ( `⚠️ حدّد مبلغاً صالحاً.\n\n*مثال:* .تحويل @مستخدم 500\n*أو:* .تحويل @مستخدم الكل`) })
    }

    if (cantidad > senderEco.bolsillo) {
      return await reply({ text: ( `❌ ليس لديك شظايا كافية في جيبك.\n\n*الجيب:* ${senderEco.bolsillo} شظية`) })
    }

    const targetEco = db.getEco(target)

    db.setEco(sender, { bolsillo: senderEco.bolsillo - cantidad })
    db.setEco(target, { bolsillo: targetEco.bolsillo + cantidad })

    await react('🎁')
    await reply({
      text: ( `🎁 *تم التبرع بنجاح*\n\n`) +
        `*De:* @${sender.split('@')[0]}\n` +
        `*Para:* @${target.split('@')[0]}\n` +
        `*Cantidad:* ${cantidad} Fragmentos\n\n` +
        `*Tu bolsillo:* ${senderEco.bolsillo - cantidad} Fragmentos`,
      mentions: [sender, target]
    })
  }
}