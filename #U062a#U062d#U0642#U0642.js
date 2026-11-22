import axios from 'axios';

const API_URL = 'https://api.lempi.lat/tools/wabancheck';
const API_KEY = 'Duarte-1311-2026';

function limpiarNumero(input) {
  return input.replace(/\D/g, '');
}

export default {
  name: ["تحقق"],
  description: "يتحقق مما إذا كان رقم واتساب محظوراً",
  category: "أدوات",
  ownerOnly: false,

  async run({ text, reply, usedPrefix, cmdName }) {
    if (!text) {
      return await reply({
        text: ( `⚠️ من فضلك، أدخل رقماً.\n\n📝 *مثال:* ${usedPrefix}${cmdName} 573131111111`)
      });
    }

    const numero = limpiarNumero(text);
    if (numero.length < 8) {
      return await reply({ text: ( `❌ رقم غير صالح.`) });
    }

    await reply({ text: ( `🌾 جارٍ الاستعلام عن حالة الرقم، انتظر لحظة...`) });

    try {
      const { data } = await axios.get(API_URL, {
        params: {
          lang: 'es',
          apikey: API_KEY,
          number: numero
        },
        timeout: 15000
      });

      if (!data?.status || !data?.resultado?.status) {
        return await reply({ text: ( `❌ تعذّر التحقق من الرقم. حاول مرة أخرى لاحقاً.`) });
      }

      const d = data.resultado.data;
      const info = d.violation_info || {};

      let texto = `乂 *B A N W A*\n\n`;
      texto += `乂 *D E T A L L E*\n\n`;
      texto += `┌  ◦  *ɴᴜᴍᴇʀᴏ:* ${data.resultado.number}\n`;
      texto += ( `│  ◦  *محظور:* ${d.isBanned ? '✅ نعم' : '❌ لا'}\n`);
      texto += ( `│  ◦  *دائم:* ${d.isPermanent ? '✅ نعم' : '❌ لا'}\n`);
      texto += ( `│  ◦  *يحتاج واتساب رسمي:* ${d.isNeedOfficialWa ? '✅ نعم' : '❌ لا'}\n`);
      texto += `│  ◦  *ᴛɪᴘᴏ ᴅᴇ ᴠɪᴏʟᴀᴄɪᴏɴ:* ${d.violation_type ?? '-'}\n`;
      texto += `│  ◦  *ᴍᴏᴛɪᴠᴏ:* ${d.status_message ?? '-'}\n`;
      texto += `│  ◦  *ᴅᴇѕᴄʀɪᴘᴄɪᴏɴ:* ${info.description ?? '-'}\n`;
      texto += `│  ◦  *ᴅᴜʀᴀᴄɪᴏɴ:* ${info.duration ?? '-'}\n`;
      texto += `│  ◦  *ʀɪᴇѕɢᴏ:* ${info.risk ?? '-'}\n`;
      texto += ( `└  ◦  *قابل للاستئناف:* ${d.in_app_ban_appeal ? '✅ نعم' : '❌ لا'}`);

      await reply({ text: texto });

    } catch (e) {
      await reply({ text: ( `❌ خطأ في الاستعلام: ${e.message}`) });
    }
  }
};