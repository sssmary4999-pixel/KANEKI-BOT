import { ITEMS } from '../../Corleone/gamedata.js'

export default {
  name: ["متجر"],
  description: 'يعرض العناصر المتاحة للشراء',
  category: "الاقتصاد",
  ownerOnly: false,

  async run({ reply, react }) {

    await react('🛒')

    const genericos = Object.entries(ITEMS).filter(([, i]) => !i.restriccion)
    const exclusivos = Object.entries(ITEMS).filter(([, i]) => i.restriccion)

    let texto = ( `🛒 *متجر الشظايا*\n╰━━━━━━(☆)━━━━━━─╮\n\n`)
    texto += `*── عناصر عامة (لأي شخصية) ──*\n\n`

    for (const [id, item] of genericos) {
      texto += `*${item.nombre}*\n`
      texto += `   💰 ${item.precio.toLocaleString()} شظية | ⚡ القوة: ${item.poder}\n`
      texto += `   🆔 \`${id}\`\n\n`
    }

    texto += `*── عناصر خاصة بشخصيات معيّنة ──*\n\n`

    for (const [id, item] of exclusivos) {
      texto += `*${item.nombre}*\n`
      texto += `   💰 ${item.precio.toLocaleString()} شظية | ⚡ القوة: ${item.poder}\n`
      texto += `   🔒 حصري لـ: *${item.restriccion}*\n`
      texto += `   🆔 \`${id}\`\n\n`
    }

    texto += ( `> استخدم *.شراء <ID>* للشراء\n> استخدم *.تجهيز <ID> <شخصية>* لتجهيزه`)

    await reply({ text: texto })
  }
}