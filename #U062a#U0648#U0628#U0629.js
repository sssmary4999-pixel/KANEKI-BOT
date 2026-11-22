import { db } from '../../database/db.js'

// الأرقام الحمراء في الروليت الأوروبي القياسي (0 = أخضر، والباقي أسود)
const ROJOS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]

const COLORES = {
  أحمر: 'أحمر', rojo: 'أحمر', red: 'أحمر', r: 'أحمر',
  أسود: 'أسود', negro: 'أسود', black: 'أسود', n: 'أسود',
  أخضر: 'أخضر', verde: 'أخضر', green: 'أخضر', v: 'أخضر'
}

function girarRuleta() {
  const numero = Math.floor(Math.random() * 37) // من 0 إلى 36
  let color = 'أسود'
  if (numero === 0) color = 'أخضر'
  else if (ROJOS.includes(numero)) color = 'أحمر'
  return { numero, color }
}

const EMOJI = { أحمر: '🔴', أسود: '⚫', أخضر: '🟢' }
const PAGO = { أحمر: 2, أسود: 2, أخضر: 14 } // معامل الربح فوق الرهان

export default {
  name: ["توبة"],
  description: 'الروليت: راهن على أحمر أو أسود أو أخضر',
  category: "الاقتصاد",
  groupOnly: true,

  async run({ sender, args, reply, react }) {

    if (args.length < 2) return await reply({ text: ( `⚠️ استخدام خاطئ.\n\n*مثال:* .توبة أحمر 500`) })

    const colorInput = COLORES[(args[0] || '').toLowerCase()]
    const apuesta = parseInt(args[1])

    if (!colorInput) return await reply({ text: ( `❌ لون غير صالح. استخدم: *أحمر*، *أسود* أو *أخضر*.`) })
    if (!apuesta || isNaN(apuesta) || apuesta <= 0) return await reply({ text: ( `❌ حدّد مبلغ رهان صالحاً.`) })

    const eco = db.getEco(sender)
    if (eco.bolsillo < apuesta) {
      return await reply({ text: ( `❌ ليس لديك شظايا كافية في جيبك.\n\n*الجيب:* ${eco.bolsillo} شظية`) })
    }

    const numero = sender.split('@')[0]

    await react('🎡')
    await reply({
      text: ( `🎡 *الروليت*\n\n@${numero} راهن بـ *${apuesta}* شظية على ${EMOJI[colorInput]} *${colorInput}*\n\n🌀 جارٍ تدوير العجلة...`),
      mentions: [sender]
    })

    await new Promise(res => setTimeout(res, 2000))

    const resultado = girarRuleta()
    const gano = resultado.color === colorInput

    let mensaje = `🎯 خرج الرقم: *${resultado.numero}* ${EMOJI[resultado.color]} (${resultado.color})\n\n`

    if (gano) {
      const ganancia = apuesta * PAGO[colorInput]
      db.setEco(sender, { bolsillo: eco.bolsillo + (ganancia - apuesta) })
      mensaje += `🏆 @${numero} ربح *${ganancia}* شظية (x${PAGO[colorInput]})`
      await react('🏆')
    } else {
      db.setEco(sender, { bolsillo: eco.bolsillo - apuesta })
      mensaje += ( `💸 @${numero} خسر رهانه.`)
      await react('💸')
    }

    await reply({ text: mensaje, mentions: [sender] })
  }
}