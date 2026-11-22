import axios from 'axios'
import { fileTypeFromBuffer } from 'file-type'

export default {
  name: ["جلب"],
  description: 'ينزّل ويرسل محتوى رابط (يدعم الصور والفيديوهات والصوتيات والنص)',
  category: "متنوع",
  ownerOnly: false,

  async run({ sock, from, msg, args, react, reply }) {

    try {
      const url = args.join(' ').trim()

      if (!url) {
        return reply({
          text: ( '❌ من فضلك، قدّم رابطاً صالحاً.\n\n*مثال:* `.fetch https://ejemplo.com/imagen.jpg`')
        })
      }

      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return reply({ text: ( '❌ يجب أن يبدأ الرابط بـ http:// أو https://') })
      }

      await react('⏳')
      await reply({ text: ( '🌐 جارٍ الاتصال بالخادم وتحميل البيانات...') })

      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })

      const buffer = Buffer.from(response.data)

      if (!buffer || buffer.length === 0) {
        throw new Error(( 'أعاد الخادم ملفاً فارغاً.'))
      }

      const detected = await fileTypeFromBuffer(buffer)
      const mime = detected?.mime || response.headers['content-type'] || 'text/plain'

      if (mime.startsWith('image/')) {
        await sock.sendMessage(from, {
          image: buffer,
          caption: ( `✅ *تم الحصول على الصورة بنجاح*`)
        }, { quoted: msg })

      } else if (mime.startsWith('video/')) {
        await sock.sendMessage(from, {
          video: buffer,
          caption: ( `✅ *تم الحصول على الفيديو بنجاح*`)
        }, { quoted: msg })

      } else if (mime.startsWith('audio/')) {
        await sock.sendMessage(from, {
          audio: buffer,
          mimetype: mime,
          ptt: mime.includes('ogg')
        }, { quoted: msg })

      } else if (mime.startsWith('text/') || mime.includes('json') || mime.includes('javascript')) {
        const textContent = buffer.toString('utf-8')

        if (textContent.length > 3000) {
          // إن كان طويلاً جداً نرسله كملف .txt قابل للتنزيل
          // حتى لا نقتطع شيئاً ويستطيع المستخدم رؤية كل شيء
          await sock.sendMessage(from, {
            document: Buffer.from(textContent),
            mimetype: 'text/plain',
            fileName: `fetch_${Date.now()}.txt`,
            caption: `📄 *المحتوى طويل جداً — يُرسل كملف*\n> الحجم: ${(textContent.length / 1024).toFixed(1)} KB`
          }, { quoted: msg })
        } else {
          await reply({
            text: ( `📄 *نتيجة طلب النص/JSON:*\n\n\`\`\`${textContent}\`\`\``)
          })
        }

      } else {
        const ext = detected?.ext || 'bin'
        await sock.sendMessage(from, {
          document: buffer,
          mimetype: mime,
          fileName: `fetch_file_${Date.now()}.${ext}`
        }, { quoted: msg })
      }

      await react('✅')

    } catch (e) {
      await react('❌')

      let errMsg = e.message
      if (e.response) {
        errMsg = ( `أجاب الخادم برمز الحالة ${e.response.status}`)
      } else if (e.code === 'ECONNABORTED') {
        errMsg = ( 'انتهت مهلة الانتظار أثناء تنزيل الملف.')
      }

      await reply({
        text: ( `❌ *خطأ أثناء الجلب:* ${errMsg}`)
      })
      console.error(e)
    }
  }
}