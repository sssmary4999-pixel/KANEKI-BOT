import { db } from '../../database/db.js'
import config from '../../Corleone/settings.js'

export default {
  name: ["حذف-اسم-الملصق"],
  description: 'يعيد ضبط علامتك المائية إلى علامة البوت',
  category: "الملصقات",
  ownerOnly: false,

  async run({ senderNum, react, reply }) {

    await react('🗑️')

    const user = db.getUser(senderNum)

    if (!user.text1 && !user.text2) {
      return await reply({
        text: ( `⚠️ ليس لديك أي علامة معيّنة.`)
      })
    }

    db.setUser(senderNum, {
      text1: null,
      text2: null
    })

    await reply({
      text: ( `✅ *أُعيدت العلامة* إلى علامة البوت\n\n📦 *الحزمة:* ${config.botname}\n✍️ *المؤلف:* ${config.author}`)
    })

    await react('✅')
  }
}