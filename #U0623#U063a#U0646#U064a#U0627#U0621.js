import { db } from '../../database/db.js'

const POR_PAGINA = 10

const numOf = (jid = '') => String(jid).split('@')[0].split(':')[0]

export default {
  name: ["أغنياء"],
  description: 'الأعلى رصيداً من الشظايا في المجموعة',
  category: "الاقتصاد",
  ownerOnly: false,
  groupOnly: true,

  async run({ args, groupMeta, reply }) {

    if (!groupMeta?.participants?.length) {
      return await reply({ text: ( '❌ تعذّرت قراءة قائمة أعضاء المجموعة.') })
    }

    // رقم -> معرّف المشارك (للإشارة بالنطاق الصحيح)
    const miembros = new Map()
    for (const p of groupMeta.participants) {
      if (!p.id) continue
      miembros.set(numOf(p.id), p.id)
      if (p.phoneNumber) miembros.set(numOf(p.phoneNumber), p.id)
      if (p.lid) miembros.set(numOf(p.lid), p.id)
    }

    // مدخل واحد لكل مشارك (إن وُجدت صفوف مكرّرة، تفوز ذات الشظايا الأكثر)
    const porJid = new Map()
    for (const u of db.getAllUsers()) {
      const num = numOf(u.jid)
      const jid = miembros.get(num)
      if (!jid) continue

      const total = (u.bolsillo ?? 0) + (u.banco ?? 0)
      if (total <= 0) continue

      const prev = porJid.get(jid)
      if (!prev || total > prev.total) porJid.set(jid, { jid, num, total })
    }

    const ranked = [...porJid.values()].sort((a, b) => b.total - a.total)

    if (ranked.length === 0) {
      return await reply({ text: ( '📉 لا أحد في هذه المجموعة لديه شظايا مسجّلة بعد.') })
    }

    const totalPaginas = Math.ceil(ranked.length / POR_PAGINA)
    const pagina = args[0] && !isNaN(parseInt(args[0]))
      ? Math.min(Math.max(parseInt(args[0]), 1), totalPaginas)
      : 1

    const inicio = (pagina - 1) * POR_PAGINA
    const paginaActual = ranked.slice(inicio, inicio + POR_PAGINA)

    let texto = ( `「✿」أصحاب أعلى *شظايا 💰* هم:\n\n`)

    texto += paginaActual.map((u, i) => {
      const posicionGlobal = inicio + i + 1
      const nombre = db.getPushName(u.num) || u.num
      return `✰ ${posicionGlobal} » *${nombre}*\n\t\t الإجمالي→ *${u.total.toLocaleString()} شظية 💰*`
    }).join('\n\n')

    texto += ( `\n\n> • الصفحة *${pagina}* من *${totalPaginas}*`)
    if (totalPaginas > 1) {
      texto += ( `\n> • استخدم *.الأغنياء 2* للصفحة التالية`)
    }

    const mentions = paginaActual.map(u => u.jid)

    return await reply({ text: texto, mentions })
  }
}