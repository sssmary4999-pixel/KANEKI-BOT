import { getAllSockets } from "../../Corleone/subbotManager.js"

const REPORT_GROUP_ID = "120363427598752084@g.us"

function cleanJid(jid = "") {
  if (!jid) return "";
  const atIndex = jid.lastIndexOf("@");
  if (atIndex === -1) return jid.split(":")[0];
  const userPart = jid.slice(0, atIndex).split(":")[0];
  const domainPart = jid.slice(atIndex + 1);
  return `${userPart}@${domainPart}`;
}

async function enviarConCualquierBot(sockOriginal, payload) {
  const candidatos = [sockOriginal, ...getAllSockets()]
  const probados = new Set()

  for (const s of candidatos) {
    if (!s || probados.has(s)) continue
    probados.add(s)
    try {
      await s.sendMessage(REPORT_GROUP_ID, payload)
      return true
    } catch (e) {
      continue
    }
  }
  return false
}

export default {
  name: ["بلاغ"],
  description: "يرسل تقريراً إلى مجموعة الإدارة",
  category: "أدوات",
  ownerOnly: false,

  async run({ sock, from, msg, text, reply, senderNum, isGroup, groupName, groupMeta }) {

    const quoted = msg.message?.extendedTextMessage?.contextInfo

    if (!text && !quoted?.stanzaId) {
      return await reply({
        text: ( "꒰✖️꒱ اكتب سبب البلاغ أو ردّ على رسالة.\n\n`✎..مثال:` *.بلاغ* أمر يوتيوب لا يعمل")
      })
    }

    const participants = groupMeta?.participants || []
    let senderRaw = msg.key.participantAlt || msg.key.participant || `${senderNum}@s.whatsapp.net`
    senderRaw = senderRaw.split(':')[0]
    let senderJid = cleanJid(senderRaw)
    if (senderRaw.endsWith('@lid')) {
      const match = participants.find(p => p.lid === senderRaw)
      if (match) senderJid = cleanJid(match.id)
    }
    const senderNumResolved = senderJid.split('@')[0]

    const origen = isGroup ? ( `المجموعة: ${groupName}`) : ( "دردشة خاصة")

    let textoReporte = `╭━━━━━━━━━━━○\n`
    textoReporte += ( `│⏤͟͟͞͞🚨 *تقرير جديد*\n`)
    textoReporte += `│\n`
    textoReporte += ( `│【👤】 *من:* ↷\n @${senderNumResolved}\n`)
    textoReporte += ( `│【📍】 *المصدر:* ${isGroup ? `المجموعة: ↷\n "${groupName}"` : origen}\n`)

    if (text) {
      textoReporte += ( `│【📝】 *السبب:* ↷\n"${text}"\n`)
    } else {
      textoReporte += ( `│【📝】 *السبب:* ↷\n"(الرسالة المقتبسة أدناه)"\n`)
    }

    textoReporte += `╰━━━━━━━━━━━━━○`

    try {
      if (quoted?.stanzaId) {
        await enviarConCualquierBot(sock, {
          forward: {
            key: {
              remoteJid: from,
              id: quoted.stanzaId,
              participant: quoted.participant,
              fromMe: false
            },
            message: quoted.quotedMessage
          }
        })
      }

      const enviado = await enviarConCualquierBot(sock, {
        text: textoReporte,
        mentions: [senderJid]
      })

      if (!enviado) {
        return await reply({ text: ( `❌ تعذّر إرسال البلاغ: لا يوجد بوت متصل في مجموعة الدعم.`) })
      }

      await reply({ text: ( "✅ أُرسل بلاغك إلى فريق الدعم. شكراً!") })
    } catch (e) {
      await reply({ text: ( `❌ تعذّر إرسال البلاغ: ${e.message}`) })
    }
  }
}