import { db } from '../../database/db.js'
import config from '../../Corleone/settings.js' // ajusta la ruta según dónde esté tu settings.js

const MAX = 999_999_999_999

// المالكون من الإعداد (ownerNumber + coOwners)
const OWNERS = [...(config.ownerNumber || []), ...(config.coOwners || [])].map(String)

function cleanJid(jid = '') {
  if (!jid) return ''
  const atIndex = jid.lastIndexOf('@')
  if (atIndex === -1) return jid.split(':')[0]
  const userPart = jid.slice(0, atIndex).split(':')[0]
  const domainPart = jid.slice(atIndex + 1)
  return `${userPart}@${domainPart}`
}

export default {
  name: ["فلوس"],
  description: 'يمنح الشظايا لمستخدم (للمالكين فقط)',
  category: "المالك",
  ownerOnly: true,

  async run({ sock, from, sender, args, msg, groupMeta, resolveLid, reply, react }) {

    // ── التحقق من المنفّذ ──
    let realSender = sender
    if (realSender.endsWith('@lid')) {
      const found = groupMeta?.participants?.find((p) => p.id === realSender || p.lid === realSender)
      realSender = found?.id || (await resolveLid(realSender))
    }
    const senderNum = cleanJid(realSender).split('@')[0]
    const botNum = cleanJid(sock.user?.id || '').split('@')[0]

    // البوت/البوت الفرعي لا يمكنه تنفيذ الأمر (يمنع خداع نفسه)
    if (msg.key?.fromMe || senderNum === botNum) {
      await react('🚫')
      return reply({ text: ( '⚠︎ لا يمكن للبوت استخدام هذا الأمر.') })
    }

    // المالكون من القائمة فقط
    if (!OWNERS.includes(senderNum)) {
      await react('🚫')
      return reply({ text: ( '⚠︎ المالك فقط يمكنه استخدام هذا الأمر.') })
    }

    const contextInfo = msg?.message?.extendedTextMessage?.contextInfo

    // الهدف: المُشار إليه > الرسالة المقتبسة > أنت
    let targetJid = contextInfo?.mentionedJid?.[0] || contextInfo?.participant || realSender

    // حلّ LID
    if (targetJid.endsWith('@lid') || isNaN(targetJid.split('@')[0])) {
      const found = groupMeta?.participants?.find((p) => p.id === targetJid || p.lid === targetJid)
      if (found?.id) targetJid = found.id
    }
    if (targetJid.endsWith('@lid')) {
      targetJid = await resolveLid(targetJid)
    }

    const target = cleanJid(targetJid)

    const campo = args.some((a) => a.toLowerCase() === 'banco') ? 'banco' : 'bolsillo'
    const num = args.find((a) => /^\d+$/.test(a))
    const cantidad = Math.min(Number(num) || MAX, MAX)

    try {
      const eco = db.getEco(target)
      db.setEco(target, { [campo]: Math.min(eco[campo] + cantidad, MAX) })
      const after = db.getEco(target)

      await react('💰')
      await sock.sendMessage(from, {
        text:
          `💰 *Listo:* @${target.split('@')[0]} recibió *${cantidad.toLocaleString('es-ES')}* Fragmentos en el *${campo}*.\n\n` +
          `👜 Bolsillo: *${after.bolsillo.toLocaleString('es-ES')}*\n` +
          `🏦 Banco: *${after.banco.toLocaleString('es-ES')}*`,
        mentions: [target]
      }, { quoted: msg })
    } catch (e) {
      console.error(( 'خطأ chetar:'), e)
      await react('❌')
      await reply({ text: ( '⚠︎ تعذّر إعطاء المال.') })
    }
  }
}