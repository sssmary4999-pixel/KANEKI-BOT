export default {
  name: ["انضمام"],
  description: 'ينضم البوت إلى مجموعة عبر رابط',
  category: "المجموعات",
  ownerOnly: true,

  async run({ sock, text, usedPrefix, react, reply }) {

    await react('⏳')

    if (!text) return await reply({
      text:
        ( `❌ الصق رابط المجموعة.\n\n`) +
        `💡 *${usedPrefix}join https://chat.whatsapp.com/XXXXXX*`
    })

    const match = text.trim().match(/chat\.whatsapp\.com\/([A-Za-z0-9]{20,24})/)

    if (!match) return await reply({
      text: ( `❌ الرابط غير صالح.\n\nيجب أن يكون: *https://chat.whatsapp.com/XXXXXX*`)
    })

    const code = match[1]

    try {
      await sock.groupAcceptInvite(code)
      await react('✅')
      await reply({
        text:
          ( `✅ *انضم البوت إلى المجموعة*\n\n`) +
          ( `🔗 *الرابط:* ${text.trim()}\n\n`) +
          `⚔️ _BOT VITO V3 | Taib_`
      })
    } catch (e) {
      await react('❌')
      console.log(e)
      await reply({ text: ( `❌ تعذّر الانضمام: ${e.message}`) })
    }
  }
}