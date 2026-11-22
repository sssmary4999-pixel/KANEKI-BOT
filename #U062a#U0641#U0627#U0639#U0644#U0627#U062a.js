import fs from "fs";
import path from "path";
import { db } from "../../database/db.js";

const DATA_PATH = path.resolve(process.cwd(), "Famiglia/database/anime.json");
const DATA = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));

/** الأسماء العربية لكل تفاعل، ليكتب المستخدم العربي الأمر بلغته. */
const NOMBRES_AR = {
  angry: "غاضب",
  bath: "حمام",
  bite: "عض",
  bleh: "لسان",
  blush: "خجل",
  bored: "ملل",
  clap: "تصفيق",
  coffee: "قهوة",
  cry: "بكاء",
  cuddle: "عناق-دافئ",
  dance: "رقص",
  drunk: "سكران",
  eat: "أكل",
  facepalm: "كف-على-الوجه",
  happy: "سعيد",
  hug: "عناق",
  kill: "قتل",
  kiss: "قبلة",
  laugh: "ضحك",
  lick: "لعق",
  love: "حب",
  pat: "تربيت",
  poke: "وكز",
  pout: "عبوس",
  punch: "لكمة",
  run: "جري",
  sad: "حزن",
  scared: "خوف",
  shy: "خجل-شديد",
  slap: "صفعة",
  sleep: "نوم",
  smoke: "تدخين",
  think: "تفكير",
};

function cleanJid(jid = "") {
  if (!jid) return "";
  const atIndex = jid.lastIndexOf("@");
  if (atIndex === -1) return jid.split(":")[0];
  const userPart = jid.slice(0, atIndex).split(":")[0];
  const domainPart = jid.slice(atIndex + 1);
  return `${userPart}@${domainPart}`;
}

function resolveDisplayName(jid, groupMeta) {
  const cached = db.getPushName(jid);
  if (cached) return cached;

  const num = jid.split("@")[0];
  const participant = groupMeta?.participants?.find(
    (p) => cleanJid(p.id).split("@")[0] === num || cleanJid(p.lid || "").split("@")[0] === num
  );
  if (participant?.username) return `@${participant.username}`;

  return num;
}

export default {
  name: [...Object.values(NOMBRES_AR)],
  description: "تفاعلات أنمي: .عناق @مستخدم، .قبلة @مستخدم، إلخ.",
  category: "الأنمي",
  adminOnly: false,
  groupOnly: true,
  showAllNames: true,

  async run({ sock, from, msg, sender, groupMeta, reply, react, cmdName, resolveLid }) {
    try {
      // الأسماء العربية تُترجم إلى مفاتيحها الأصلية قبل البحث في DATA.
      const AR_A_ES = Object.fromEntries(
        Object.entries(NOMBRES_AR).map(([es, ar]) => [ar, es])
      );
      const raw = (cmdName || "").toLowerCase();
      const category = AR_A_ES[raw] || raw;
      const entry = DATA[category];
      if (!entry) return;

      const contextInfo = msg?.message?.extendedTextMessage?.contextInfo;

      let who = sender;
      if (contextInfo?.mentionedJid?.length > 0) {
        who = contextInfo.mentionedJid[0];
      } else if (contextInfo?.participant) {
        who = contextInfo.participant;
      }

      // 🔧 حلّ LID: أولاً عبر groupMeta (المعرّف أو lid)، وإن
      // بقي LID، فحلّه حياً عبر signalRepository (مجموعات مهاجَرة
      // بالكامل إلى LID حيث لا يوجد حقل "lid" منفصل).
      if (who.endsWith("@lid") || isNaN(who.split("@")[0])) {
        const found = groupMeta?.participants?.find((p) => p.id === who || p.lid === who);
        if (found?.id && !found.id.endsWith("@lid")) {
          who = found.id;
        } else if (who.endsWith("@lid")) {
          const resolved = await resolveLid(who);
          if (resolved && resolved !== who) who = resolved;
        }
      }

      const authorJid = cleanJid(sender);
      const mentionedJid = cleanJid(who);
      const isSelf = mentionedJid === authorJid;

      const video = entry.videos[Math.floor(Math.random() * entry.videos.length)];

      const authorName = msg.pushName || resolveDisplayName(authorJid, groupMeta);
      const targetName = isSelf ? null : resolveDisplayName(mentionedJid, groupMeta);

      const authorTag = `\`${authorName}\``;
      const targetTag = targetName ? `\`${targetName}\`` : null;

      const selfTxt = entry.selfAr || entry.self;
      const targetTxt = entry.targetAr || entry.target;
      const caption = isSelf
        ? `${authorTag} ${selfTxt}`
        : `${authorTag} ${targetTxt} ${targetTag}`;

      const mentions = isSelf ? [authorJid] : [authorJid, mentionedJid];

      await sock.sendMessage(
        from,
        { video: { url: video }, caption, mentions, gifPlayback: true },
        { quoted: msg }
      );
    } catch (e) {
      console.error(e);
      await react("❌");
      await reply({ text: ( `فشل`) });
    }
  },
};