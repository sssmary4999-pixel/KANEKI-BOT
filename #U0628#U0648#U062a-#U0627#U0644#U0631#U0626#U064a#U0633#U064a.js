import { db } from '../../database/db.js'
import { activeBots, claimOnce } from '../../Corleone/subbotManager.js'

function cleanJid(jid = "") {
  if (!jid) return "";
  const atIndex = jid.lastIndexOf("@");
  if (atIndex === -1) return jid.split(":")[0];
  const userPart = jid.slice(0, atIndex).split(":")[0];
  const domainPart = jid.slice(atIndex + 1);
  return `${userPart}@${domainPart}`;
}

export default {
  name: ["بوت-الرئيسي"],
  description: 'يعيّن بوتاً كرئيسي للمجموعة',
  category: "المجموعات",
  groupOnly: true,
  adminOnly: true,

  async run({ from, msg, react, reply, resolveLid }) {

    if (!claimOnce(msg.key.id)) return

    const parseNum = (jid) => jid ? jid.split('@')[0] : null
    const primary = db.getPrimary(from)

    // إشارة مباشرة داخل رسالة الأمر: .setprimary @رقم
    const ownMentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []

    // اقتباس رسالة من البوت (السلوك السابق، نُبقيه كخيار احتياطي)
    const quoted = msg.message?.extendedTextMessage?.contextInfo || msg.message?.imageMessage?.contextInfo || msg.message?.videoMessage?.contextInfo
    const quotedMentions = quoted?.mentionedJid || []
    const targetRaw = ownMentions[0]
      ? cleanJid(ownMentions[0])
      : (quotedMentions[0] ? cleanJid(quotedMentions[0]) : (quoted?.participant ? cleanJid(quoted.participant) : null))

    let quotedSender = null
    if (targetRaw) {
      const resolved = await resolveLid(targetRaw)
      quotedSender = parseNum(cleanJid(resolved))
    }

    const botsActivos = [...activeBots.entries()].filter(([, bot]) => bot.status === 'online')

    if (!quotedSender) {
      let texto = ( `أي بوت تريد كرئيسي؟\n\n`)
      for (const [, bot] of botsActivos) {
        const num = parseNum(cleanJid(bot.jid)) || 'N/A'
        texto += `  ✦ *${bot.label || 'Sub-Bot'}* → @${num}\n`
      }
      texto += ( `\nاذكر ذلك البوت (@رقم) ونفّذ *.البوت-الرئيسي* مجدداً.`)

      const mentionJids = botsActivos.map(([, bot]) => cleanJid(bot.jid)).filter(Boolean)
      return await reply({ text: texto, mentions: mentionJids })
    }

    const esBotValido = botsActivos.some(([, bot]) => parseNum(cleanJid(bot.jid)) === quotedSender)

    if (!esBotValido) {
      return await reply({
        text: ( `هذا الرقم ليس بوتاً فرعياً لهذا البوت. يمكنك تعيين بوت رئيسي أو فرعي نشط من هذه الجلسة فقط.`)
      })
    }

    const whoNum = quotedSender
    const whoJid = cleanJid(`${whoNum}@s.whatsapp.net`)

    if (primary === whoNum) {
      return await reply({ text: ( `@${whoNum} هو بالفعل البوت الرئيسي لهذه المجموعة.`), mentions: [whoJid] })
    }

    db.setPrimary(from, whoNum)

    await react('✅')
    await reply({
      text:
        ( `تم تعيين البوت الرئيسي\n\n`) +
        ( `@${whoNum} هو الآن البوت الرئيسي.\n`) +
        ( `لن تستجيب بقية البوتات في هذه المجموعة.`),
      mentions: [whoJid]
    })
  }
}