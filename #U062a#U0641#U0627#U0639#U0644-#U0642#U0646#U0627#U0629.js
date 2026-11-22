import { broadcastReaccionCanal } from '../../Corleone/subbotManager.js'

export default {
  name: ["تفاعل-قناة"],
  description: 'يجعل جميع البوتات تتفاعل مع رسالة قناة',
  category: "أدوات",
  ownerOnly: false,

  async run({ sock, args, reply, react }) {

    const [link, emoji] = args

    if (!link || !emoji) {
      return await reply({ text: ( '⚠️ استخدم: *.تفاعل-قناة <رابط الرسالة> <إيموجي>*') })
    }

    const match = link.match(/channel\/([A-Za-z0-9]+)\/(\d+)/)
    if (!match) {
      return await reply({ text: ( '❌ هذا ليس رابط رسالة قناة صالحاً.') })
    }

    const [, invite, serverId] = match

    await react('🐢')
    await reply({ text: ( `🐢 *جارٍ المعالجة...* التفاعل بـ ${emoji} في كل البوتات (~5 ثوانٍ).`) })

    // المعرّف الحقيقي للقناة (xxxx@newsletter)، وليس رمز الدعوة
    let canalJid
    try {
      const meta = await sock.newsletterMetadata('invite', invite)
      canalJid = meta.id
    } catch (e) {
      console.error(( 'تعذّر الحصول على القناة:'), e)
      await react('❌')
      return await reply({ text: ( '❌ تعذّر العثور على القناة. تحقق من الرابط.') })
    }

    let res
    try {
      res = await broadcastReaccionCanal({ canalJid, serverId, emoji, ventanaMs: 5000 })
    } catch (e) {
      console.error(( 'خطأ في البث:'), e)
      await react('❌')
      return await reply({ text: ( '❌ حدث خطأ أثناء التفاعل.') })
    }

    if (res.ok > 0) {
      await react('✅')
      await reply({
        text: ( `✅ تم: ${res.ok}/${res.total} بوت تفاعل مع ${emoji}${res.fail ? ` (${res.fail} فشلوا)` : ''}`)
      })
    } else {
      await react('❌')
      await reply({ text: ( '❌ لم يستطع أي بوت التفاعل. تحقق من الرابط.') })
    }
  }
}