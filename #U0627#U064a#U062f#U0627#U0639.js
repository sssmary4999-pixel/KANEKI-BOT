import { db } from '../../database/db.js'

export default {
  name: ["ايداع", "سحب"],
  description: 'ينقل الشظايا بين المحفظة والبنك',
  category: "الاقتصاد",
  ownerOnly: false,

  async run({ sender, cmdName, args, reply, react }) {

    const eco = db.getEco(sender)
    const disponible = cmdName === 'ايداع' ? eco.bolsillo : eco.banco

    let cantidad
    const arg = (args[0] || '').toLowerCase()

    if (arg === 'all' || arg === 'الكل') {
      cantidad = disponible
    } else {
      cantidad = parseInt(args[0])
    }

    if (!cantidad || isNaN(cantidad) || cantidad <= 0) {
      return await reply({ text: ( `⚠️ حدّد مبلغاً صالحاً.\n\n*مثال:* .${cmdName} 500\n*أو:* .${cmdName} all`) })
    }

    if (cmdName === 'ايداع') {
      if (cantidad > eco.bolsillo) {
        return await reply({ text: ( `❌ ليس لديك شظايا كافية في جيبك.\n\n*الجيب:* ${eco.bolsillo} شظية`) })
      }

      db.setEco(sender, {
        bolsillo: eco.bolsillo - cantidad,
        banco: eco.banco + cantidad
      })

      await react('🏦')
      await reply({
        text: ( `🏦 *تم الإيداع بنجاح*\n\n`) +
          ( `*المودَع:* ${cantidad} شظية\n`) +
          ( `*المحفظة:* ${eco.bolsillo - cantidad} شظية\n`) +
          ( `*البنك:* ${eco.banco + cantidad} شظية`)
      })

    } else if (cmdName === 'سحب') {
      if (cantidad > eco.banco) {
        return await reply({ text: ( `❌ ليس لديك شظايا كافية في البنك.\n\n*البنك:* ${eco.banco} شظية`) })
      }

      db.setEco(sender, {
        bolsillo: eco.bolsillo + cantidad,
        banco: eco.banco - cantidad
      })

      await react('👜')
      await reply({
        text: ( `👜 *تم السحب بنجاح*\n\n`) +
          ( `*المسحوب:* ${cantidad} شظية\n`) +
          ( `*المحفظة:* ${eco.bolsillo + cantidad} شظية\n`) +
          ( `*البنك:* ${eco.banco - cantidad} شظية`)
      })
    }
  }
}