import axios from "axios";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_DIR = path.join(__dirname, "../../../tmp");

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const MAX_INPUT_MB = 500;

// يقبل كل أنواع روابط تيك توك (قصيرة، طويلة، مع بارامترات، مشفرة)
function validateTikTokUrl(url) {
  if (!url) return null;
  const regex = /^https?:\/\/(?:www\.|vm\.|vt\.|m\.)?tiktok\.com\/[^\s]+/i;
  const match = url.match(regex);
  return match ? match[0] : null;
}

// ينظّف الرابط من البارامترات الزائدة (tracking params)
function cleanTikTokUrl(url) {
  try {
    const u = new URL(url);
    const pathMatch = u.pathname.match(/^\/(@[\w.\-]+\/video\/\d+|t\/\w+)/);
    if (pathMatch) {
      return `https://www.tiktok.com${pathMatch[0]}`;
    }
    return url;
  } catch {
    return url;
  }
}

async function downloadTikTok(url) {
  try {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;

    const { data } = await axios.get(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        Referer: "https://www.tikwm.com/",
        Origin: "https://www.tikwm.com",
      },
      timeout: 15000,
    });

    if (data.code === 0 && data.data && data.data.play) {
      const d = data.data;
      return {
        videoUrl: d.play,
        title: d.title,
        authorNick: d.author?.nickname || "غير معروف",
        likes: d.digg_count,
        shares: d.share_count,
        downloads: d.download_count,
        comments: d.comment_count,
      };
    }
    throw new Error("لا توجد بيانات فيديو");
  } catch (error) {
    throw new Error(`خطأ واجهة tikwm: ${error.message}`);
  }
}

async function downloadToFile(url, destPath) {
  const response = await axios.get(url, {
    responseType: "stream",
    timeout: 60000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  await pipeline(response.data, fs.createWriteStream(destPath));
}

async function validateOutput(outPath) {
  if (!fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
    throw new Error(`أنتج ffmpeg ملفاً فارغاً أو غير موجود: ${outPath}`);
  }

  const { stdout } = await execAsync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${outPath}"`
  );
  const outDuration = parseFloat(stdout.trim());

  if (!outDuration || outDuration <= 0) {
    throw new Error(`أنتج ffmpeg ملفاً تالفاً (مدة غير صالحة): ${outPath}`);
  }
}

async function processVideo(inputPath, outPath) {
  const MAX_SIZE_MB = 60;
  const originalSizeMB = fs.statSync(inputPath).size / (1024 * 1024);

  if (originalSizeMB <= MAX_SIZE_MB) {
    await execAsync(
      `ffmpeg -y -fflags +genpts -i "${inputPath}" -c copy -avoid_negative_ts make_zero -movflags +faststart "${outPath}"`
    );
    await validateOutput(outPath);
    return;
  }

  const { stdout: fpsRaw } = await execAsync(
    `ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`
  );
  const fps = fpsRaw.trim() || "30/1";

  let scaleFilter = "";
  if (originalSizeMB > 150) {
    scaleFilter = `-vf "scale='min(854,iw)':-2"`;
  } else if (originalSizeMB > 100) {
    scaleFilter = `-vf "scale='min(1280,iw)':-2"`;
  }

  await execAsync(
    `ffmpeg -y -fflags +genpts -i "${inputPath}" ${scaleFilter} -r ${fps} -threads 2 ` +
      `-c:v libx264 -preset ultrafast -crf 28 ` +
      `-c:a aac -b:a 96k -avoid_negative_ts make_zero -movflags +faststart "${outPath}"`,
    { maxBuffer: 1024 * 1024 * 20, timeout: 600000 }
  );

  await validateOutput(outPath);
}

export default {
  name: ["تيك"],
  description: "تحميل فيديوهات تيك توك بسرعة",
  category: "التحميل",
  groupOnly: false,

  async run({ sock, from, msg, senderNum, args, usedPrefix, cmdName, reply, react }) {
    const T = {
      needUrl: `🎵 يرجى إرسال رابط تيك توك.\n\n📝 *مثال:* ${usedPrefix}${cmdName} https://www.tiktok.com/@usuario/video/1234567890`,
      invalidUrl: `❌ رابط تيك توك غير صالح. يرجى التحقق من الرابط.\n\n✅ *الروابط الصحيحة:*\n• https://www.tiktok.com/@usuario/video/...\n• https://vm.tiktok.com/...\n• https://vt.tiktok.com/...`,
      downloading: `> ✎...جاري تحميل الفيديو.`,
      failDownload: `❌ لم يتم تحميل الفيديو. قد يكون الرابط خاصاً أو غير صالح.`,
      tooLarge: (size) => `❌ الفيديو بحجم ${size}MB، كبير جداً للمعالجة (الحد الأقصى: ${MAX_INPUT_MB}MB).`,
      compressing: (size) => `⏳ الفيديو بحجم ${size}MB، جاري ضغطه قبل الإرسال (قد يستغرق دقائق)...`,
      cantCompress: (size) => `❌ لم يتم ضغط الفيديو (${size}MB) وهو ثقيل جداً للإرسال بدون ضغط.`,
      noTitle: "بدون عنوان",
      caption: (author, likes, shares, downloads, comments, title) =>
        `☑ *تم تحميل فيديو تيك توك*\n` +
        `─╮\n` +
        `   ╰━━━━━━(☆)━━━━━━─╮\n` +
        `*👤 الناشر:* ${author}\n` +
        `*♡ الإعجابات:* ${likes}\n` +
        `*⌲ المشاركات:* ${shares}\n` +
        `*⎙ الحفظ:* ${downloads}\n` +
        `*○ التعليقات:* ${comments}\n` +
        `*📹 العنوان:* ${title}`,
      error: (e) => `❌ خطأ أثناء معالجة التحميل: ${e}`,
    };

    // contextInfo مشترك (يُستدعى من global)
    const buildContextInfo = () => ({
      mentionedJid: [msg.sender || `${senderNum}@s.whatsapp.net`],
      isForwarded: true,
      forwardingScore: 1,
      forwardedNewsletterMessageInfo: {
        newsletterJid: global.my?.canal1,
        newsletterName: global.botNames[Math.floor(Math.random() * global.botNames.length)],
        serverMessageId: -1,
      },
    });

    // helper لإرسال الردود مع معاينة القناة
    const sendWithChannel = async (content) => {
      if (typeof content === "string") content = { text: content };
      content.mentions = [...new Set([msg.sender || `${senderNum}@s.whatsapp.net`, ...(content.mentions || [])])];
      content.contextInfo = buildContextInfo();
      return await sock.sendMessage(from, content, { quoted: msg });
    };

    if (!args[0]) {
      return await sendWithChannel({ text: T.needUrl });
    }

    const tiktokUrl = validateTikTokUrl(args[0]);
    if (!tiktokUrl) {
      return await sendWithChannel({ text: T.invalidUrl });
    }

    const cleanUrl = cleanTikTokUrl(tiktokUrl);

    await react("🔄");
    await sendWithChannel({ text: T.downloading });

    const id = crypto.randomBytes(8).toString("hex");
    const inputPath = path.join(TMP_DIR, `tt_${id}.mp4`);
    const outPath = path.join(TMP_DIR, `tt_${id}_out.mp4`);

    try {
      const result = await downloadTikTok(cleanUrl);

      if (!result || !result.videoUrl) {
        await react("❌");
        return await sendWithChannel({ text: T.failDownload });
      }

      await downloadToFile(result.videoUrl, inputPath);

      const sizeMB = fs.statSync(inputPath).size / (1024 * 1024);

      if (sizeMB > MAX_INPUT_MB) {
        await react("❌");
        fs.unlinkSync(inputPath);
        return await sendWithChannel({ text: T.tooLarge(sizeMB.toFixed(0)) });
      }

      if (sizeMB > 60) {
        await sendWithChannel({ text: T.compressing(sizeMB.toFixed(0)) });
      }

      let finalPath = inputPath;
      try {
        await processVideo(inputPath, outPath);
        finalPath = outPath;
      } catch (e) {
        console.error("تعذّر معالجة الفيديو:", e?.stack || e.message);

        const inputSizeMB = fs.statSync(inputPath).size / (1024 * 1024);
        if (inputSizeMB > 60) {
          await react("❌");
          return await sendWithChannel({ text: T.cantCompress(inputSizeMB.toFixed(0)) });
        }
      }

      const title = result.title?.trim() || T.noTitle;
      const author = result.authorNick || "غير معروف";

      const caption = T.caption(
        author,
        result.likes ?? "N/A",
        result.shares ?? "N/A",
        result.downloads ?? "N/A",
        result.comments ?? "N/A",
        title
      );

      await sendWithChannel({
        video: { url: finalPath },
        mimetype: "video/mp4",
        fileName: "tiktok.mp4",
        caption,
      });

      await react("✅");
    } catch (error) {
      console.error("خطأ في تحميل تيك توك:", error?.stack || error);
      await react("❌");
      await sendWithChannel({ text: T.error(error.message) });
    } finally {
      try { fs.unlinkSync(inputPath); } catch {}
      try { fs.unlinkSync(outPath); } catch {}
    }
  },
};
