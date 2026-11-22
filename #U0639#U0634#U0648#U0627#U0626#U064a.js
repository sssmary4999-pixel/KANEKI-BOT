import { randomUUID } from 'crypto'
import { proto, generateWAMessageFromContent } from '@whiskeysockets/baileys'

const CTA_TYPES = ['OPEN_URL', 'COPY', 'CALL', 'QUICK_REPLY']

const buildSections = (items) => {
  const submessages = []
  const sections = []

  for (const i of items) {
    if (i.text !== undefined) {
      submessages.push({
        messageType: proto.AIRichResponseSubMessageType.AI_RICH_RESPONSE_TEXT,
        messageText: i.text
      })
      sections.push({
        view_model: {
          primitive: { text: i.text, __typename: 'GenAIMarkdownTextUXPrimitive' },
          __typename: 'GenAISingleLayoutViewModel'
        }
      })
      continue
    }

    if (i.image !== undefined) {
      const media = {
        url: i.image,
        mime_type: i.mimetype || 'image/png',
        __typename: 'GenAIMediaItem'
      }
      sections.push({
        view_model: {
          primitive: {
            preview_image: media,
            full_image: media,
            __typename: 'GenAIImagePrimitive'
          },
          __typename: 'GenAISingleLayoutViewModel'
        }
      })
      continue
    }

    if (i.cta_button) {
      const type = (i.cta_button.type || 'OPEN_URL').toUpperCase()
      if (!CTA_TYPES.includes(type)) throw new Error(( `نوع cta غير صالح: ${type}`))
      sections.push({
        view_model: {
          primitive: {
            cta_text: i.cta_button.text,
            cta_type: type,
            cta_url: i.cta_button.url,
            __typename: 'GenAIFooterActionPrimitive'
          },
          __typename: 'GenAISingleLayoutViewModel'
        }
      })
      continue
    }

    throw new Error(( `عنصر غير مدعوم: ${JSON.stringify(i)}`))
  }

  return { submessages, sections }
}

export const sendMetaMsg = async (sock, jid, items, quoted, disclaimer) => {
  const { submessages, sections } = buildSections(items)
  const data = Buffer.from(JSON.stringify({ response_id: randomUUID(), sections })).toString('base64')

  const content = {
    messageContextInfo: {
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
      botMetadata: {
        pluginMetadata: {},
        messageDisclaimerText: disclaimer || ( `أُرسل بواسطة ${global.botname || 'BOT VITO V3'}`)
      }
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: proto.AIRichResponseMessageType.AI_RICH_RESPONSE_TYPE_STANDARD,
          submessages,
          unifiedResponse: { data },
          contextInfo: {
            isForwarded: true,
            forwardingScore: 1,
            forwardedAiBotMessageInfo: { botJid: '0@bot' },
            forwardOrigin: proto.ContextInfo.ForwardOrigin.META_AI
          }
        }
      }
    }
  }

  const m = generateWAMessageFromContent(jid, content, { quoted, userJid: sock.user.id })
  await sock.relayMessage(jid, m.message, { messageId: m.key.id })
  return m
}

export default {
  name: ["عشوائي"],
  description: 'يرسل رسالة بنمط Meta AI مع نص وصورة وزر',
  category: "المالك",

  async run({ sock, from, msg, text, usedPrefix, command, reply }) {

    if (!text) {
      return await reply({
        text: ( `> *🦖 المحتوى ناقص.*\n\n🍀 *الاستخدام:* ${usedPrefix || '.'}${command} نص | صورة | زر | رابط | تنبيه\n\n☔ *مثال:*\n${usedPrefix || '.'}${command} مرحباً من Vito | https://whatsapp.com/channel/0029Vb8hDbBDuMRXBFk3u02L | زيارة | https://whatsapp.com | Powered by Taib\n\n_التنبيه هو النص الصغير بالأسفل. يمكنك حذف أجزاء بترك الفراغ بين الأشرطة._`)
      })
    }

    const [body, image, btnText, btnUrl, disclaimer] = text.split('|').map((s) => s.trim())

    const items = []
    if (body) items.push({ text: body })
    if (image) items.push({ image })
    if (btnText && btnUrl) items.push({ cta_button: { text: btnText, type: 'OPEN_URL', url: btnUrl } })

    if (!items.length) return await reply({ text: ( '🍡 آسف، لا يوجد شيء لإرساله.') })

    try {
      await sendMetaMsg(sock, from, items, msg, disclaimer)
    } catch (e) {
      console.error(e)
      await reply({ text: `${e.message}` })
    }
  }
}
