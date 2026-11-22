import axios from 'axios'
import { prepareWAMessageMedia } from '@whiskeysockets/baileys'

const FRAME_ORIGIN = 'https://frame.y2meta-uk.com'
const API_BASE = 'https://cnv.cx/v2'
const LIMIT_MB = 80
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const ID_RE = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/))([\w-]{11})/

const MEDIA_OPTS = {
  options: { timeout: 0, maxRedirects: 10, maxContentLength: Infinity, maxBodyLength: Infinity, headers: { 'user-agent': 'Mozilla/5.0' } },
  mediaUploadTimeoutMs: 1000 * 60 * 60
}

// ===== y2meta: المفتاح + نفق التنزيل =====
async function obtenerKey(videoId) {
  const res = await fetch(`${API_BASE}/sanity/key?id=${encodeURIComponent(videoId)}`, {
    headers: {
      'Origin': FRAME_ORIGIN,
      'Referer': FRAME_ORIGIN + '/',
      'Accept': '*/*',
      'Content-Type': 'application/json',
      'User-Agent': UA
    }
  })
  if (!res.ok) throw new Error(`sanity/key ردّ بـ ${res.status}`)
  const data = await res.json()
  if (!data.key) throw new Error(( 'sanity/key لم يعِد مفتاحاً'))
  return data.key
}

async function obtenerAudio(videoId) {
  const key = await obtenerKey(videoId)

  const body = new URLSearchParams({
    link: `https://youtu.be/${videoId}`,
    format: 'mp3',
    audioBitrate: '128',
    videoQuality: '720',
    filenameStyle: 'pretty',
    vCodec: 'h264'
  })

  const res = await fetch(`${API_BASE}/converter`, {
    method: 'POST',
    headers: {
      'Origin': FRAME_ORIGIN,
      'Referer': FRAME_ORIGIN + '/',
      'Accept': '*/*',
      'Content-Type': 'application/x-www-form-urlencoded',
      'key': key,
      'User-Agent': UA
    },
    body
  })
  if (!res.ok) throw new Error(`المحوّل ردّ بـ ${res.status}`)

  const data = await res.json()
  if (!data.url) throw new Error(( 'المحوّل لم يُعِد رابطاً'))
  return { url: data.url, filename: data.filename || `${videoId}.mp3` }
}

// ===== تنزيل النفق مع ترويسات الصفحة =====
async function descargarBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 0,
    maxRedirects: 10,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    headers: {
      'User-Agent': UA,
      'Origin': FRAME_ORIGIN,
      'Referer': FRAME_ORIGIN + '/',
      'Accept': '*/*'
    }
  })
  return Buffer.from(res.data)
}

// ===== مستخرج يوتيوب (ytsearch) =====
async function buscarYouTube(query, limite = 5) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=es`
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'es-ES,es;q=0.9',
      'Cookie': 'CONSENT=YES+1; SOCS=CAI'
    }
  })
  const html = await res.text()

  const m = html.match(/var ytInitialData\s*=\s*(\{.+?\});<\/script>/s)
  if (!m) throw new Error(( 'تعذّرت قراءة صفحة يوتيوب'))

  const data = JSON.parse(m[1])
  const secciones =
    data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || []

  const resultados = []
  for (const sec of secciones) {
    for (const item of sec?.itemSectionRenderer?.contents || []) {
      const v = item.videoRenderer
      if (!v?.videoId || !v.lengthText) continue // salta en vivo, shorts y anuncios

      resultados.push({
        id: v.videoId,
        titulo: v.title?.runs?.[0]?.text || ( 'بدون عنوان'),
        canal: v.ownerText?.runs?.[0]?.text || ( 'غير معروف'),
        duracion: v.lengthText?.simpleText || '--:--',
        vistas: v.viewCountText?.simpleText || '',
        fecha: v.publishedTimeText?.simpleText || '',
        url: `https://youtu.be/${v.videoId}`,
        thumb: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`
      })
      if (resultados.length >= limite) return resultados
    }
  }
  return resultados
}

// ===== معلومات الفيديو (للمعاينة) =====
async function buscarVideo(query, id) {
  try {
    const results = await buscarYouTube(id || query, 5)
    const v = id ? results.find(r => r.id === id) : results[0]
    if (!v) return null
    return {
      url: v.url,
      title: v.titulo,
      timestamp: v.duracion,
      views: v.vistas,
      thumbnail: v.thumb,
      author: { name: v.canal }
    }
  } catch {
    return null
  }
}

async function buildLinkPreview(sock, imagen, title, description, url) {
  try {
    const { imageMessage } = await prepareWAMessageMedia(
      { image: { url: imagen } },
      { upload: sock.waUploadToServer, mediaTypeOverride: 'thumbnail-link' }
    )
    return {
      'canonical-url': url,
      'matched-text': url,
      title,
      description,
      jpegThumbnail: imageMessage?.jpegThumbnail ? Buffer.from(imageMessage.jpegThumbnail) : undefined,
      highQualityThumbnail: imageMessage || undefined
    }
  } catch {
    return undefined
  }
}

const cleanFileName = name =>
  String(name).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 100) || 'audio'

export default {
  name: ["يوتيوب-تحميل"],
  description: 'ينزّل صوتاً من يوتيوب عبر y2mate',
  category: "التحميل",
  ownerOnly: false,

  async run({ sock, from, msg, react, reply, text, args }) {

    try {
      const query = (text || args.join(' ')).trim()
      if (!query) {
        return reply({ text: ( '⛧ اكتب اسم الفيديو أو رابطه') })
      }

      await react('🎧')

      const idDirecto = query.match(ID_RE)?.[1]

      // إن وُجد الرابط، ابدأ التنزيل بالتوازي أثناء جلب المعلومات
      let descarga = null
      if (idDirecto) {
        descarga = obtenerAudio(idDirecto)
        descarga.catch(() => {})
      }

      const info = await buscarVideo(query, idDirecto)

      if (!info && !idDirecto) {
        await react('❌')
        return reply({ text: ( '⛧ لم أجد نتائج') })
      }

      const url = info?.url || `https://youtu.be/${idDirecto}`
      const id = idDirecto || url.match(ID_RE)?.[1]
      if (!id) {
        await react('❌')
        return reply({ text: ( '⛧ لم أستطع استخراج معرّف الفيديو') })
      }

      const title = info?.title || ( 'بدون عنوان')
      const duration = info?.timestamp || ( 'غير متاح')
      const vistas = info?.views || ( 'غير متاح')
      const thumbnail = info?.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`

      if (!descarga) {
        descarga = obtenerAudio(id)
        descarga.catch(() => {})
      }

      const captionText =
        `⛧ ${title}\n\n` +
        `⛧ vistas › ${vistas}\n` +
        `⛧ المدة › ${duration}\n` +
        ( `⛧ الرابط › ${url}`)

      const linkPreview = await buildLinkPreview(sock, thumbnail, title, info?.author?.name || 'YouTube', url)

      await sock.sendMessage(from, { text: captionText, linkPreview }, { quoted: msg })

      const resDl = await descarga
      const dl = resDl?.url
      if (!dl) {
        await react('❌')
        return reply({ text: ( '⛧ خطأ: لم يُحصل على رابط الصوت') })
      }

      const fileName = `${cleanFileName(title !== ( 'بدون عنوان') ? title : resDl.filename.replace(/\.mp3$/i, ''))}.mp3`

      const buffer = await descargarBuffer(dl)
      const sizeMB = buffer.length / 1024 / 1024

      if (sizeMB >= LIMIT_MB) {
        await sock.sendMessage(from, {
          document: buffer,
          mimetype: 'audio/mpeg',
          fileName,
          caption: ( '⛧ أُرسل الصوت كمستند بسبب الحجم')
        }, { quoted: msg, ...MEDIA_OPTS })
      } else {
        await sock.sendMessage(from, {
          audio: buffer,
          mimetype: 'audio/mpeg',
          fileName,
          ptt: false
        }, { quoted: msg, ...MEDIA_OPTS })
      }

      await react('✅')
    } catch (e) {
      console.error('[dl:y2mate]', e?.message || e)
      await react('❌')
      await reply({ text: ( `⛧ خطأ: ${e.message}`) })
    }
  }
}
