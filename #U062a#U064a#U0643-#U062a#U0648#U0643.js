import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmp = path.join(__dirname, '../../../tmp');

if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });

function validateTikTokUrl(url) {
  if (!url) return null;
  const regex = /^(https?:\/\/)?(www\.|vm\.|vt\.)?tiktok\.com\/[\w\d@?=&/.-]+/i;
  const match = url.match(regex);
  return match ? match[0] : null;
}

async function downloadTikTokNormal(url) {
  try {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;

    const { data } = await axios.get(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.tikwm.com/',
        'Origin': 'https://www.tikwm.com'
      },
      timeout: 15000
    });

    if (data.code === 0 && data.data && data.data.play) {
      const d = data.data;

      return {
        videoUrl: d.play,
        title: d.title,
        authorNick: d.author?.nickname || ( 'غير معروف'),
        likes: d.digg_count,
        shares: d.share_count,
        downloads: d.download_count,
        comments: d.comment_count
      };
    }
    throw new Error(( 'لا توجد بيانات فيديو'));
  } catch (error) {
    throw new Error(( `خطأ واجهة TikWM: ${error.message}`));
  }
}

async function descargarAArchivo(url, destPath) {
  const response = await axios.get(url, {
    responseType: 'stream',
    timeout: 60000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  await pipeline(response.data, fs.createWriteStream(destPath));
}

async function validarSalida(outP) {
  if (!fs.existsSync(outP) || fs.statSync(outP).size === 0) {
    throw new Error(`ffmpeg أنتج ملفاً فارغاً أو غير موجود: ${outP}`);
  }

  const { stdout } = await execAsync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${outP}"`
  );
  const outDuration = parseFloat(stdout.trim());

  if (!outDuration || outDuration <= 0) {
    throw new Error(`ffmpeg أنتج ملفاً تالفاً (مدة غير صالحة): ${outP}`);
  }
}

async function processVideoFile(inputP, outP) {
  const MAX_SIZE_MB = 60;
  const originalSizeMB = fs.statSync(inputP).size / (1024 * 1024);

  if (originalSizeMB <= MAX_SIZE_MB) {
    // إعادة تغليف صافية: دون فقدان جودة/دقة/fps، تُصلح الطوابع الزمنية فقط
    await execAsync(
      `ffmpeg -y -fflags +genpts -i "${inputP}" -c copy -avoid_negative_ts make_zero -movflags +faststart "${outP}"`
    );
    await validarSalida(outP);
    return;
  }

  const { stdout: fpsRaw } = await execAsync(
    `ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of default=noprint_wrappers=1:nokey=1 "${inputP}"`
  );
  const fps = fpsRaw.trim() || "30/1";

  // خادم بمعالج/ذاكرة قليلين: نوسّع نطاق العمل حسب الحجم الأصلي
  // حتى ينتهي ffmpeg دون تعليق أو تأخير مفرط.
  let scaleFilter = "";
  if (originalSizeMB > 150) {
    scaleFilter = `-vf "scale='min(854,iw)':-2"`;
  } else if (originalSizeMB > 100) {
    scaleFilter = `-vf "scale='min(1280,iw)':-2"`;
  }

  await execAsync(
    `ffmpeg -y -fflags +genpts -i "${inputP}" ${scaleFilter} -r ${fps} -threads 2 ` +
    `-c:v libx264 -preset ultrafast -crf 28 ` +
    `-c:a aac -b:a 96k -avoid_negative_ts make_zero -movflags +faststart "${outP}"`,
    { maxBuffer: 1024 * 1024 * 20, timeout: 600000 }
  );

  await validarSalida(outP);
}

const MAX_INPUT_MB = 500;

export default {
  name: ["تيك-توك"],
  description: 'ينزّل فيديوهات تيك توك بسرعة',
  category: "التحميل",
  groupOnly: false,

  async run({ sock, from, msg, args, usedPrefix, cmdName, reply, react }) {

    if (!args[0]) {
      return await reply({
        text: ( `🎵 من فضلك، أدخل رابط تيك توك.\n\n📝 *مثال:* ${usedPrefix}${cmdName} https://www.tiktok.com/@user/video/1234567890`)
      });
    }

    const tiktokUrl = validateTikTokUrl(args[0]);
    if (!tiktokUrl) {
      return await reply({
        text: ( `❌ رابط تيك توك غير صالح. تحقق من الرابط.\n\n✅ *روابط صالحة:*\n• https://www.tiktok.com/@user/video/...\n• https://vm.tiktok.com/...\n• https://vt.tiktok.com/...`)
      });
    }

    await react('🔄');
    await reply({ text: ( `> ✎...جارٍ تحميل الفيديو.`) });

    const id = crypto.randomBytes(8).toString('hex');
    const inputP = path.join(tmp, `tt_${id}.mp4`);
    const outP = path.join(tmp, `tt_${id}_out.mp4`);

    try {
      const result = await downloadTikTokNormal(tiktokUrl);

      if (!result || !result.videoUrl) {
        await react('❌');
        return await reply({ text: ( `❌ تعذّر تحميل الفيديو. قد يكون الرابط خاصاً أو غير صالح.`) });
      }

      await descargarAArchivo(result.videoUrl, inputP);

      const sizeMB = fs.statSync(inputP).size / (1024 * 1024);

      if (sizeMB > MAX_INPUT_MB) {
        await react('❌');
        fs.unlinkSync(inputP);
        return await reply({
          text: ( `❌ الفيديو بحجم ${sizeMB.toFixed(0)}MB، كبير جداً للمعالجة (الحد: ${MAX_INPUT_MB}MB).`)
        });
      }

      if (sizeMB > 60) {
        await reply({
          text: ( `⏳ الفيديو بحجم ${sizeMB.toFixed(0)}MB، جارٍ الضغط قبل الإرسال (قد يستغرق دقائق)...`)
        });
      }

      let finalPath = inputP;
      try {
        await processVideoFile(inputP, outP);
        finalPath = outP;
      } catch (e) {
        console.error(( 'تعذّرت معالجة الفيديو:'), e?.stack || e.message);

        const inputSizeMB = fs.statSync(inputP).size / (1024 * 1024);
        if (inputSizeMB > 60) {
          await react('❌');
          return await reply({
            text: ( `❌ تعذّر ضغط الفيديو (${inputSizeMB.toFixed(0)}MB) وهو ثقيل جداً للإرسال بدون ضغط.`)
          });
        }
      }

      const titulo = result.title?.trim() || ( 'بدون عنوان');

      let caption = ( `☑ *تم تنزيل فيديو تيك توك*\n`);
      caption += `─╮\n`;
      caption += `   ╰━━━━━━(☆)━━━━━━─╮\n`;
      caption += ( `*👤 الناشر:* ${result.authorNick || 'غير معروف'}\n`);
      caption += `*♡ ʟɪᴋᴇs:* ${result.likes ?? 'N/A'}\n`;
      caption += `*⌲ sʜᴀʀᴇ:* ${result.shares ?? 'N/A'}\n`;
      caption += `*⎙ sᴀᴠᴇ:* ${result.downloads ?? 'N/A'}\n`;
      caption += `*○ ᴄᴏᴍᴍᴇɴᴛ:* ${result.comments ?? 'N/A'}\n`;
      caption += `*📹 ᴛɪᴛᴜʟᴏ:* ${titulo}`;

      await sock.sendMessage(from, {
        video: { url: finalPath },
        mimetype: 'video/mp4',
        fileName: 'tiktok.mp4',
        caption
      }, { quoted: msg });

      await react('✅');

    } catch (error) {
      console.error(( 'خطأ في تنزيل تيك توك:'), error?.stack || error);
      await react('❌');
      await reply({
        text: ( `❌ خطأ في معالجة التحميل: ${error.message}`)
      });
    } finally {
      try { fs.unlinkSync(inputP); } catch {}
      try { fs.unlinkSync(outP); } catch {}
    }
  }
};