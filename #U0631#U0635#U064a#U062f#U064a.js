import { db } from '../../database/db.js'

export default {
  name: ["رصيدي"],
  description: 'يعرض رصيد الشظايا',
  category: "الاقتصاد",
  ownerOnly: false,

  async run({ sender, senderNum, reply, react }) {

    const eco = db.getEco(sender)
    const total = eco.bolsillo + eco.banco

    await react('💎')
    await reply({
      text: (
        `💎 *رصيد الشظايا*\n` +
        `╰━━━━━━(☆)━━━━━━─╮\n\n` +
        `*👜 المحفظة:* ${eco.bolsillo} شظية\n` +
        `*🏦 البنك:* ${eco.banco} شظية\n` +
        `*📊 الإجمالي:* ${total} شظية`)
    })
  }
}