const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

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

export default {
  name: ["يوتيوب-بحث"],
  description: 'يبحث عن موسيقى أو فيديوهات في يوتيوب',
  category: "أدوات",

  async run({ sock, from, msg, text, reply, react }) {

    if (!text) {
      return await reply({ text: ( '🌾 استخدم: *.يوتيوب-بحث <أغنية أو فنان>*') })
    }

    await react('🍁')

    try {
      const lista = await buscarYouTube(text, 5)

      if (!lista.length) {
        await react('❌')
        return await reply({ text: ( '🍂 لم تُعثر على نتائج.') })
      }

      let cap = ( `🌾 *بحث في يوتيوب* 🎵\n🪴 _${text}_\n\n`)
      lista.forEach((r, i) => {
        cap += `*${i + 1}.* ${r.titulo}\n`
        cap += `🍁 ${r.canal}\n`
        cap += `🌿 ${r.duracion}${r.vistas ? ' • ' + r.vistas : ''}${r.fecha ? ' • ' + r.fecha : ''}\n`
        cap += `🍃 ${r.url}\n\n`
      })

      await sock.sendMessage(from, {
        image: { url: lista[0].thumb },
        caption: cap.trim()
      }, { quoted: msg })

      await react('✅')
    } catch (e) {
      console.error(( 'خطأ في البحث عن يوتيوب:'), e)
      await react('❌')
      await reply({ text: ( '⚠︎ تعذّر البحث في يوتيوب.') })
    }
  }
}