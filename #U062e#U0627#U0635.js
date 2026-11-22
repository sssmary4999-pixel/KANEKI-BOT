import { downloadMediaMessage } from '@whiskeysockets/baileys'

export default {
  name: ["خاص"],
  description: 'يحوّل فيديو مردوداً عليه إلى ملاحظة فيديو',
  category: "متنوع",
  ownerOnly: false,

  async run({ sock, from, msg, react, reply }) {

    const msgType = Object.keys(msg.message || {})[0]
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo
    const quoted = contextInfo?.quotedMessage
    const quotedType = quoted ? Object.keys(quoted)[0] : null

    const isVideo = msgType === 'videoMessage'
    const isQuotedVideo = quotedType === 'videoMessage'

    if (!isVideo && !isQuotedVideo) {
      return reply({ text: ( '❌ ردّ على فيديو لتحويله إلى رسالة فيديو (pvt).') })
    }

    await react('⏳')

    const targetMsg = isVideo
      ? msg
      : {
          key: {
            remoteJid: from,
            id: contextInfo?.stanzaId,
            participant: contextInfo?.participant
          },
          message: quoted
        }

    let videoBuffer
    try {
      videoBuffer = await downloadMediaMessage(targetMsg, 'buffer', {}, { sock })
    } catch (e) {
      await react('❌')
      return reply({ text: ( '❌ تعذّر تحميل الفيديو.') })
    }

    await sock.sendMessage(from, {
      video: videoBuffer,
      mimetype: 'video/mp4',
      ptv: true,
      contextInfo: {
        mentionedJid: [msg.key?.participant || from],
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: '120363429662971001@newsletter',
          newsletterName: global.my?.canalName || '⚔️ 𝙱𝙾𝚃 𝚅𝙸𝚃𝙾 𝚅𝟹 │ 𝐂𝐇𝐀𝐍𝐍𝐄𝐋',
          serverMessageId: -1
        }
      }
    }, { quoted: msg })

    await react('✅')
  }
}