import { db } from '../../database/db.js'
import fs from 'fs'
import path from 'path'

export default {
  name: ["حفظ-اضافة"], // Nombre plano para evitar fallos en el handler
  description: 'يحفظ ملف إضافة ديناميكياً بالردّ على كودها.',
  category: "المالك",

  async run({ sock, from, msg, senderNum, args, usedPrefix, react, reply }) {

    try {
      const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net'

      // التحقق من الصلاحيات عبر db.js
      const isOwner = db.hasRole(senderNum, 'owner') || db.hasRole(senderNum, 'coowner')
      const isSelf = senderNum === botJid

      if (!isOwner && !isSelf) {
        await react('❌')
        return await reply({ text: ( '❌ هذا الأمر للمالك أو المالك المشارك فقط.') })
      }

      // التحقق مما إذا كان يردّ على رسالة
      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
      if (!quotedMsg) {
        await react('❌')
        return await reply({ text: ( `⚠️ يجب *الرد على الرسالة التي تحتوي على كود* الإضافة.`) })
      }

      // استخراج النص
      const codigo = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text
      if (!codigo) {
        await react('❌')
        return await reply({ text: ( `❌ الرسالة المُردود عليها لا تحتوي على نص صالح.`) })
      }

      // التحقق من الوسائط
      if (!args[0]) {
        await react('💡')
        return await reply({ 
          text: ( `💡 *الاستخدام الصحيح:* 💡\n`) +
                ( `ردّ على الكود واستخدم: *${usedPrefix}saveplugin [مجلد]/[اسم].js*\n\n`) +
                `*أمثلة:*\n` +
                `• ${usedPrefix}saveplugin owner/prueba.js\n` +
                `• ${usedPrefix}saveplugin herramientas/calculadora.js\n` +
                `• ${usedPrefix}saveplugin miplugin.js`
        })
      }

      await react('🕒')

      const baseDir = process.cwd()
      let inputPath = args[0].replace(/\.\.\//g, '')
      if (!inputPath.endsWith('.js')) inputPath += '.js'

      const targetPath = path.join(baseDir, 'Famiglia', 'plugins', inputPath)
      const targetDir = path.dirname(targetPath)

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
      }

      fs.writeFileSync(targetPath, codigo, 'utf8')
      await react('✅')
      
      return await reply({
        text: ( `✅ *تم حفظ الإضافة بنجاح!*\n\n`) +
              `📂 *Carpeta:* \`Famiglia/plugins/${path.relative(path.join(baseDir, 'Famiglia', 'plugins'), targetDir) || 'Raíz'}\`\n` +
              ( `📄 *الملف:* \`${path.basename(targetPath)}\``)
      })

    } catch (error) {
      await react('❌')
      await reply({ text: ( `❌ خطأ في حفظ-اضافة: ${error.message}`) })
      console.error(error)
    }
  }
}
