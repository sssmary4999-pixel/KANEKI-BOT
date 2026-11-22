import { Readable } from "node:stream";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const MAX_MB = 100; // por encima de esto manda el enlace directo en vez del archivo
const HEAD_TIMEOUT = 20000;

const MIMES = {
  mp4: "video/mp4", mkv: "video/x-matroska", webm: "video/webm", mov: "video/quicktime",
  mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg", wav: "audio/wav", flac: "audio/flac",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  html: "text/html", htm: "text/html", txt: "text/plain", pdf: "application/pdf",
  zip: "application/zip", apk: "application/vnd.android.package-archive",
};

const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#38;/g, "&");
const extDe = (n) => (n.split(".").pop() || "").toLowerCase();

const abrirConTimeout = async (url, headers = {}) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), HEAD_TIMEOUT);
  try {
    // المهلة تغطي الاتصال فقط؛ قد يستغرق الجسم ما يشاء
    return await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "es-419,es;q=0.9", ...headers },
      signal: ctrl.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(t);
  }
};

async function resolver(url) {
  const res = await abrirConTimeout(url);
  if (!res.ok) throw new Error(( `HTTP ${res.status} عند فتح الصفحة`));

  if (!/text\/html/i.test(res.headers.get("content-type") || "")) {
    return { directo: res.url, nombre: null };
  }

  const html = await res.text();
  let directo = null;

  const scr = html.match(/data-scrambled-url="([^"]+)"/i);
  if (scr) {
    try { directo = Buffer.from(scr[1], "base64").toString("utf8"); } catch {}
  }
  if (!directo) {
    const btn =
      html.match(/id="downloadButton"[^>]*href="([^"]+)"/i) ||
      html.match(/href="([^"]+)"[^>]*id="downloadButton"/i);
    if (btn) directo = decode(btn[1]);
  }
  if (!directo) {
    const any = html.match(/https?:\/\/download\d*\.mediafire\.com\/[^"'\s<>]+/i);
    if (any) directo = decode(any[0]);
  }
  if (!directo || !/^https?:\/\//i.test(directo)) {
    throw new Error(( "لم أجد الرابط المباشر (الملف محذوف أو خاص أو محمي بكابتشا)."));
  }

  const nombre = html.match(/<div[^>]*class="filename"[^>]*>([^<]+)</i)?.[1]?.trim() || null;
  return { directo, nombre };
}

export default {
  name: ["ميديافاير"],
  description: "ينزّل ملفات من MediaFire عبر الرابط (صوت، فيديو، HTML، zip، إلخ)",
  category: "التحميل",
  groupOnly: false,

  async run({ sock, from, msg, text, usedPrefix, reply, react }) {

    try {
      if (!text) {
        return await reply({
          text: ( `⚠️ أرسل رابط ميديافاير.\n\n💡 *الاستخدام:* ${usedPrefix || "."}mf <link>`),
        });
      }

      const link = text.match(/https?:\/\/(www\.)?mediafire\.com\/\S+/i)?.[0];
      if (!link) {
        return await reply({ text: ( "❌ هذا لا يبدو رابط ميديافاير صالحاً.") });
      }
      if (/mediafire\.com\/folder\//i.test(link)) {
        return await reply({ text: ( "❌ المجلدات غير مدعومة، أرسل رابط ملف.") });
      }

      await react("⏳");

      const { directo, nombre: nombreHTML } = await resolver(link);

      const res = await abrirConTimeout(directo, { Referer: "https://www.mediafire.com/" });
      if (!res.ok) throw new Error(( `HTTP ${res.status} عند التنزيل`));
      if (/text\/html/i.test(res.headers.get("content-type") || "") && !/\.html?$/i.test(nombreHTML || "")) {
        throw new Error(( "أعاد الخادم صفحة بدلاً من الملف (الرابط منتهي)."));
      }

      const nombre = (
        nombreHTML ||
        decodeURIComponent(new URL(res.url).pathname.split("/").pop() || "ملف")
      ).replace(/[\\/:*?"<>|]+/g, "_");

      const bytes = Number(res.headers.get("content-length")) || 0;
      const mb = bytes / 1048576;

      if (mb > MAX_MB) {
        await res.body?.cancel();
        await react("✅");
        return await reply({
          text: ( `📦 *${nombre}* بحجم ${mb.toFixed(1)} MB، كبير جداً للإرسال هنا.\n\n🔗 رابط مباشر:\n${directo}`),
        });
      }

      const ext = extDe(nombre);
      let mimetype = res.headers.get("content-type") || "";
      if (!mimetype || /octet-stream/i.test(mimetype)) mimetype = MIMES[ext] || "application/octet-stream";

      const stream = Readable.fromWeb(res.body);
      const caption = `ها هو ذا :D\n\n📄 ${nombre}${bytes ? ` (${mb.toFixed(1)} MB)` : ""}`;

      if (/^video\//.test(mimetype) && mb <= 64) {
        await sock.sendMessage(from, { video: { stream }, caption, mimetype }, { quoted: msg });
      } else if (/^audio\//.test(mimetype)) {
        await sock.sendMessage(from, { audio: { stream }, mimetype, fileName: nombre }, { quoted: msg });
      } else if (/^image\//.test(mimetype) && mb <= 16) {
        await sock.sendMessage(from, { image: { stream }, caption }, { quoted: msg });
      } else {
        await sock.sendMessage(
          from,
          { document: { stream }, mimetype, fileName: nombre, caption },
          { quoted: msg }
        );
      }

      await react("✅");
    } catch (e) {
      console.error("[mediafire]", e);
      await react("❌");
      await reply({ text: ( `❌ خطأ في التحميل: ${e.message}`) });
    }
  },
};
