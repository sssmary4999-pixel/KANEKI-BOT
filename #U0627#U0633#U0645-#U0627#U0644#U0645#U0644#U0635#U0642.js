import { db } from '../../database/db.js'

export default {
  name: ["اسم-الملصق"],
  description: 'يغيّر علامتك المائية للملصقات',
  category: "الملصقات",
  ownerOnly: false,

  async run({ senderNum, text, react, reply }) {

    await react('⚙️')

    if (!text) {
      return await reply({
        text:
          ( `❌ الاستخدام:\n`) +
          `*.اسم-الملصق المؤلف*\n` +
          ( `*.اسم-الملصق الحزمة | المؤلف*\n\n`) +
          `مثال:\n` +
          `*.اسم-الملصق Taib*\n` +
          `*.اسم-الملصق BOT VITO V3 | Taib*`
      })
    }

    const user = db.getUser(senderNum)

    // في SQLite، إن لم يكن هناك إعداد، يأتي text1 و text2 كـ null
    if (user.text1 || user.text2) {
      return await reply({
        text: ( `⚠️ لديك علامة معيّنة بالفعل.\nاستخدم *.حذف-اسم-الملصق* لحذفها أولاً.`)
      })
    }

    const texto = text.trim()
    let packName = ''
    let authorName = ''

    if (texto.includes('|')) {
      const [pack, author] = texto.split('|').map(v => v.trim())
      packName = pack || texto
      authorName = author || texto
    } else {
      packName = texto
      authorName = texto
    }

    // 🌟 هنا التغيير: الحفظ مباشرة في SQLite
    db.setUser(senderNum, { text1: packName, text2: authorName });

    await reply({
      text:
        ( `✅ *تم تحديث العلامة*\n\n`) +
        ( `📦 *الحزمة:* ${packName}\n`) +
        `✍️ *Autor:* ${authorName}`
    })
    await react('✅')
  }
}