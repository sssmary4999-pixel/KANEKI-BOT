import axios from 'axios'
import { prepareWAMessageMedia, generateWAMessageFromContent } from '@whiskeysockets/baileys'
import { totalmem, freemem, platform } from 'os'
import path from 'path'
import { pathToFileURL } from 'url'

const BANNER_DEFAULT = 'https://cdn.dix.lat/me/f5f104cd-9fb7-4d71-82bf-04bac49f8813.jpg'
const LINK = global.my?.canalUrl || 'https://whatsapp.com/channel/0029Vb8hDbBDuMRXBFk3u02L'
const CREADOR = 'Taib'
const GRUPOS_TTL = 5 * 60 * 1000
const BANNER_TTL = 60 * 60 * 1000

const CANAL = {
  newsletterJid: '120363429662971001@newsletter',
  newsletterName: global.my?.canalName || '⚔️ 𝙱𝙾𝚃 𝚅𝙸𝚃𝙾 𝚅𝟹 │ 𝐂𝐇𝐀𝐍𝐍𝐄𝐋',
  serverMessageId: -1
}

let cacheGrupos = { n: 0, exp: 0 }
const bannerCache = new Map() // url -> { media, exp }

// استيراد من جذر المشروع، فلا يعتمد على مجلد الإضافة
const importar = (ruta) => import(pathToFileURL(path.resolve(ruta)).href)

const getTs = (ts) => (typeof ts === 'object' ? Number(ts?.low ?? ts) : Number(ts))

function formatBytes(bytes) {
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024
    i++
  }
  return `${Number(n.toFixed(2))} ${u[i]}`
}

function clockString(ms) {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor(ms / 60000) % 60
  const s = Math.floor(ms / 1000) % 60
  return `${h}h ${m}m ${s}s`
}

// يحصي المجموعات الفريدة بين كل البوتات (الرئيسي + الفرعية)، مع تخزين مؤقت
async function contarGrupos(bots) {
  if (cacheGrupos.exp > Date.now()) return cacheGrupos.n

  const res = await Promise.allSettled(bots.map((b) => b.groupFetchAllParticipating()))
  const ids = new Set()
  for (const r of res) {
    if (r.status !== 'fulfilled') continue
    for (const g of Object.values(r.value)) ids.add(g.id)
  }

  cacheGrupos = { n: ids.size, exp: Date.now() + GRUPOS_TTL }
  return ids.size
}

// مصغّرة معاينة الرابط. التخزين المؤقت حسب الرابط: إن غيّرت البانر يُرفع من جديد.
async function getBannerMedia(sock, url) {
  const hit = bannerCache.get(url)
  if (hit && hit.exp > Date.now()) return hit.media

  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 })
  const { imageMessage } = await prepareWAMessageMedia(
    { image: Buffer.from(res.data) },
    { upload: sock.waUploadToServer, mediaTypeOverride: 'thumbnail-link' }
  )

  bannerCache.set(url, { media: imageMessage, exp: Date.now() + BANNER_TTL })
  return imageMessage
}

export default {
  name: ["معلومات"],
  description: 'يعرض معلومات وحالة البوت',
  category: "المعلومات",

  async run({ sock, from, msg, react, reply, usedPrefix, sender, senderNum, isOwner, isCoOwner, isMod, isPremium }) {

    try {
      const { db } = await importar('./Famiglia/database/db.js')
      const { default: config } = await importar('./Famiglia/Corleone/settings.js')
      const { getPlugins } = await importar('./Famiglia/Corleone/pluginLoader.js')
      const { getAllSockets, getMainSock } = await importar('./Famiglia/Corleone/subbotManager.js')

      // نفس بانر واسم القائمة (يُقرأ من قاعدة البيانات عند كل استخدام)
      const currentBotNum = sock.user?.id ? sock.user.id.split('@')[0].split(':')[0].replace(/\D/g, '') : ''
      const currentBotJid = currentBotNum ? `${currentBotNum}@s.whatsapp.net` : ''
      const botData = db.getBot(currentBotJid) || db.getBot('main')

      const esLabelAutomatico = botData?.label?.startsWith('SUB_') || botData?.label === 'Subbot' || botData?.label === 'MAIN'
      const nombreBot = (esLabelAutomatico || !botData?.label ? config.botName : botData.label).replace(/@\d+/g, '').trim()
      const urlFoto = botData?.banner || BANNER_DEFAULT

      const ts = Number(msg.messageTimestamp) || Math.floor(Date.now() / 1000)
      const latencia = Math.max(0, Date.now() - ts * 1000)
      const uptime = clockString(process.uptime() * 1000)

      const totalRam = totalmem()
      const usedRam = totalRam - freemem()
      const ramPercentage = Math.round((usedRam / totalRam) * 100)

      const bots = getAllSockets().filter((b) => b?.user)
      const grupos = await contarGrupos(bots)
      const users = db.countUsers ? db.countUsers() : db.getAllUsers().length
      const plugins = new Set(getPlugins().values()).size

      const rol = isOwner ? 'owner' : isCoOwner ? 'coowner' : isMod ? 'mod' : isPremium ? 'premium' : 'user'
      const esMainBot =
        sock.isMainBot === true
          ? true
          : sock.isMainBot === false
            ? false
            : sock === getMainSock() || botData?.isMain === true || botData?.isMain === 1 || (global.mainBotNum && currentBotNum === String(global.mainBotNum))
      const tipoBot = esMainBot ? 'البوت الرئيسي' : 'بوت فرعي'

      const info =
        `✦ *${nombreBot}*\n\n` +
        `❖ مرحباً › @${senderNum}\n` +
        `✧ الدور › ${rol}\n` +
        `❀ البادئة › ${usedPrefix}\n` +
        `◈ الاستجابة › ${latencia} ms\n` +
        `☾ مدة التشغيل › ${uptime}\n\n` +
        `✿ المسجّلون › ${users}\n` +
        `⚝ المجموعات › ${grupos}\n` +
        `❁ الإضافات › ${plugins}\n` +
        `✺ البوتات المتصلة › ${bots.length}\n` +
        `❃ النوع › ${tipoBot}\n\n` +
        `❂ المنصّة › ${platform()}\n` +
        `⟡ ram › ${formatBytes(usedRam)} / ${formatBytes(totalRam)} (${ramPercentage}%)\n\n` +
        `✪ المطوّر › ${CREADOR}\n` +
        `❄ url › ${LINK}`

      // بانر البوت؛ إن لم يُحمّل المُعدّل، استخدم الاحتياطي
      let img
      try {
        img = await getBannerMedia(sock, urlFoto)
      } catch {
        img = await getBannerMedia(sock, BANNER_DEFAULT)
      }

      const content = {
        extendedTextMessage: {
          endCardTiles: [],
          text: info,
          matchedText: LINK,
          canonicalUrl: LINK,
          description: `Powered by ${CREADOR} | ${nombreBot}`,
          title: nombreBot.toUpperCase(),
          previewType: 0,
          jpegThumbnail: img.jpegThumbnail,
          thumbnailDirectPath: img.directPath,
          thumbnailSha256: img.fileSha256,
          thumbnailEncSha256: img.fileEncSha256,
          mediaKey: img.mediaKey,
          mediaKeyTimestamp: getTs(img.mediaKeyTimestamp),
          thumbnailHeight: img.height || 1080,
          thumbnailWidth: img.width || 1920,
          inviteLinkGroupTypeV2: 0,
          contextInfo: {
            mentionedJid: [sender],
            isForwarded: true,
            forwardingScore: 1,
            forwardedNewsletterMessageInfo: CANAL
          }
        }
      }

      const waMsg = generateWAMessageFromContent(from, content, { userJid: sock.user?.id, quoted: msg })
      await sock.relayMessage(from, waMsg.message, { messageId: waMsg.key.id })

      await react('✅')
    } catch (e) {
      console.error('[info:botinfo]', e?.message || e)
      await react('❌')
      await reply({ text: ( `✦ خطأ: ${e.message}`) })
    }
  }
}