import axios from "axios";
import { generateWAMessageFromContent, generateWAMessage, delay } from "@whiskeysockets/baileys";

async function sendAlbumMessage(sock, jid, medias, options = {}) {
  if (medias.length < 2) throw new RangeError(( "يلزم صورتان على الأقل للألبوم"))
  const caption = options.caption || ""
  const quoted  = options.quoted || null

  const album = generateWAMessageFromContent(
    jid,
    { messageContextInfo: {}, albumMessage: { expectedImageCount: medias.length } },
    quoted ? { quoted } : {}
  )

  await sock.relayMessage(album.key.remoteJid, album.message, { messageId: album.key.id })

  for (let i = 0; i < medias.length; i++) {
    const { type, data } = medias[i]
    const img = await generateWAMessage(
      album.key.remoteJid,
      { [type]: data, ...(i === 0 ? { caption } : {}) },
      { upload: sock.waUploadToServer }
    )
    img.message.messageContextInfo = {
      messageAssociation: { associationType: 1, parentMessageKey: album.key }
    }
    await sock.relayMessage(img.key.remoteJid, img.message, { messageId: img.key.id })
    await delay(500)
  }

  return album
}

export default {
  name: ["بينتريست"],
  description: "يبحث عن صور في بينتريست",
  category: "التحميل",
  ownerOnly: false,

  async run({ sock, from, msg, text, usedPrefix, react, reply }) {

    try {
      await react("⏳")

      if (!text) return await reply({
        text:
          ( `❌ يجب أن تكتب ما تريد البحث عنه.\n\n`) +
          ( `💡 *الاستخدام:*\n`) +
          `  ✦ ${usedPrefix}pinterest goku\n` +
          `  ✦ ${usedPrefix}pin anime wallpaper\n\n` +
          `⚔️ _BOT VITO V3 | Taib_`
      })

      await reply({
        text:
          ( `🔍 _جارٍ البحث عن صور_ *${text}*...\n`) +
          ( `⏳ _انتظر لحظة..._`)
      })

      const res = await axios.get(`https://api.alyacore.xyz/search/pinterest`, {
        params: { query: text, key: "Duarte-zz12" },
        timeout: 10000
      })

      const data = res.data

      if (!data.status || !Array.isArray(data.data) || data.data.length < 2) {
        return await reply({
          text:
            ( `❌ لم يتم العثور على صور لـ *${text}*.\n\n`) +
            `⚔️ _BOT VITO V3 | Taib_`
        })
      }

      const total  = Math.min(data.data.length, 10)
      const images = data.data.slice(0, total).map(img => ({
        type: "image",
        data: { url: img.hd }
      }))

      const caption =
        ( `✨ ═══ 🫧 *بينتريست* 🫧 ═══ ✨\n\n`) +
        ( `🔎 *البحث:* ${text}\n`) +
        ( `🖼️ *الصور:* ${total}\n\n`) +
        `⚔️ _BOT VITO V3 | Taib_`

      await sendAlbumMessage(sock, from, images, { caption, quoted: msg })

      await react("✅")

    } catch (error) {
      await react("❌")
      await reply({
        text:
          ( `✨ ═══ 🫧 *بينتريست* 🫧 ═══ ✨\n\n`) +
          ( `❌ *خطأ:* ${error.message}\n\n`) +
          `⚔️ _BOT VITO V3 | Taib_`
      })
      console.error(( "خطأ في pinterest:"), error)
    }
  }
}