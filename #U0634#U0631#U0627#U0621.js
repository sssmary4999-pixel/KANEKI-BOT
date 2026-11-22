import { db } from '../../database/db.js'
import { ITEMS } from '../../Corleone/gamedata.js'

export default {
  name: ["شراء"],
  description: 'يشتري عنصراً من المتجر',
  category: "الاقتصاد",
  ownerOnly: false,

  async run({ sender, args, reply, react }) {

    const itemId = args[0]?.toLowerCase()

    if (!itemId) {
      return await reply({ text: ( `⚠️ حدّد معرّف العنصر.\n\n*مثال:* .شراء pala\n\n> استخدم *.متجر* لعرض العناصر المتاحة`) })
    }

    const item = ITEMS[itemId]
    if (!item) {
      return await reply({ text: ( `❌ العنصر غير موجود.\n\n> استخدم *.متجر* لعرض العناصر المتاحة`) })
    }

    const eco = db.getEco(sender)

    if (eco.inventario.includes(itemId)) {
      return await reply({ text: ( `❌ لديك *${item.nombre}* بالفعل في حقيبتك.`) })
    }

    if (eco.bolsillo < item.precio) {
      const faltante = item.precio - eco.bolsillo
      return await reply({
        text: ( `❌ ليس لديك شظايا كافية.\n\n`) +
          `*السعر:* ${item.precio.toLocaleString()} شظية\n` +
          `*المحفظة:* ${eco.bolsillo.toLocaleString()} شظية\n` +
          `*ينقصك:* ${faltante.toLocaleString()} شظية`
      })
    }

    const nuevoInventario = [...eco.inventario, itemId]
    db.setEco(sender, {
      bolsillo: eco.bolsillo - item.precio,
      inventario: nuevoInventario
    })

    await react('✅')
    await reply({
      text: ( `✅ *تم الشراء بنجاح*\n\n`) +
        `*العنصر:* ${item.nombre}\n` +
        `*المبلغ المدفوع:* ${item.precio.toLocaleString()} شظية\n` +
        `*المتبقي في المحفظة:* ${(eco.bolsillo - item.precio).toLocaleString()} شظية\n\n` +
        ( `> استخدم *.تجهيز ${itemId} <شخصية>* لإعطائه لشخصية`)
    })
  }
}