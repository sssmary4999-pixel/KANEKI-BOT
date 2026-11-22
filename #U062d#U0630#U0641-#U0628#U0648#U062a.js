import { removeSubbot, activeBots } from '../../Corleone/subbotManager.js'

export default {
  name: ["حذف-بوت"],
  description: 'يفصل رقمك عن البوت الفرعي',
  category: "البوتات الفرعية",
  ownerOnly: false,

  async run({ senderNum, react, reply }) {

    await react('🗑️')

    const id = `sub_${senderNum}`

    if (!activeBots.has(id)) {
      return await reply({ text: ( `❌ ليس لديك أي بوت فرعي مرتبط.`) })
    }

    removeSubbot(id)
    await reply({ text: ( `✅ فُصل بوتك الفرعي وحُذفت الجلسة.`) })
  }
}