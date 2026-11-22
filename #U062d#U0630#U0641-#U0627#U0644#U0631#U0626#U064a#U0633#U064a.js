import { db } from '../../database/db.js'
import { claimOnce } from '../../Corleone/subbotManager.js'

export default {
  name: ["حذف-الرئيسي"],
  description: 'يزيل البوت الرئيسي من المجموعة',
  category: "المجموعات",
  groupOnly: true,
  adminOnly: true,

  async run({ from, msg, react, reply }) {

    if (!claimOnce(msg.key.id)) return

    const primary = db.getPrimary(from)
    if (!primary) {
      return await reply({
        text:
          ( `⚠️ *لا يوجد بوت رئيسي معيّن لهذه المجموعة.*\n\n`) +
          ( `💡 استخدم *.البوت-الرئيسي* لتعيين واحد.`)
      })
    }

    db.delPrimary(from)

    await react('🗑️')
    await reply({
      text:
        ( `✅ *أُزيل البوت الرئيسي*\n\n`) +
        ( `ستستجيب جميع البوتات والفرعية في هذه المجموعة الآن.`)
    })
  }
}