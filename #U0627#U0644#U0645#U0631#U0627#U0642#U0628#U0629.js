import { log } from "../logger.js";

// آخر اسم/وصف معروف لكل مجموعة، لعرض التغيير بصيغة «من ← إلى».
// الجرد الجماعي (groupFetchAllParticipating) يبثّ بيانات المجموعة كاملة بلا
// `author`، فنميّزه عن التغيير الحقيقي: نحدّث الذاكرة صامتين بلا إشعار.
const known = new Map();
const MAX_KNOWN = 500;

const numOf = (jid = "") => String(jid).split("@")[0].split(":")[0];

/** يجلب صورة المجموعة المراقَبة، ويعود إلى صور البوت عند تعذّرها. */
async function groupImage(sock, groupJid) {
  const urls = [];
  try {
    const url = await sock.profilePictureUrl(groupJid, "image");
    if (url) urls.push(url);
  } catch {}

  if (Array.isArray(global.botImages) && global.botImages.length) {
    urls.push(global.botImages[Math.floor(Math.random() * global.botImages.length)]);
  }

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      return Buffer.from(await res.arrayBuffer());
    } catch {}
  }
  return null;
}

/** يرسل نص المراقبة مع صورة المجموعة إن توفّرت، وإلا نصاً فقط. */
async function sendMonitor(sock, groupJid, text, mentions) {
  const image = await groupImage(sock, groupJid);
  if (image) {
    try {
      await sock.sendMessage(groupJid, { image, caption: text, mentions });
      return;
    } catch {}
  }
  await sock.sendMessage(groupJid, { text, mentions });
}

function jidOf(p) {
  if (!p) return null;
  if (typeof p === "string") return p;
  return p.id || p.jid || p.participant || p.participantAlt || null;
}

function remember(groupJid, patch) {
  const cur = { ...(known.get(groupJid) || {}) };
  if (patch.subject !== undefined) cur.subject = patch.subject;
  if (patch.desc !== undefined) cur.desc = patch.desc;
  known.set(groupJid, cur);
  if (known.size > MAX_KNOWN) known.delete(known.keys().next().value);
  return cur;
}

export default {
  name: "المراقبة",
  flag: "monitor",

  async onGroupUpdate({ sock, groupJid, update, botLabel }) {
    const prev = { ...(known.get(groupJid) || {}) };
    const after = remember(groupJid, update);

    // بلا فاعل = جرد جماعي لا تغيير حقيقي.
    if (!update.author) return false;

    const lines = [];

    if (update.subject !== undefined && update.subject !== prev.subject) {
      lines.push(prev.subject ? `📝 *الاسم:* ${prev.subject} ← ${after.subject}` : `📝 *الاسم:* ${after.subject}`);
    }

    if (update.desc !== undefined && update.desc !== prev.desc) {
      const to = (after.desc || "").trim() || "(فارغ)";
      lines.push(prev.desc !== undefined ? `📄 *الوصف:* ${(prev.desc || "").trim() || "(فارغ)"} ← ${to}` : `📄 *الوصف:* ${to}`);
    }

    if (!lines.length) return false;

    await sendMonitor(
      sock,
      groupJid,
      `👁️ *مراقبة المجموعة*\n👤 بواسطة: @${numOf(update.author)}\n\n${lines.join("\n")}`,
      [update.author],
    );
    log.info(`[${botLabel}] المراقبة: تغيير في ${groupJid}`);
    return true;
  },

  async onPromote({ sock, groupJid, participants, actor, botLabel }) {
    const list = [...new Set((participants || []).map(jidOf).filter(Boolean))];
    if (!list.length) return false;

    const who = list.map((j) => `@${numOf(j)}`).join("، ");
    await sendMonitor(
      sock,
      groupJid,
      `👁️ *مراقبة المجموعة*\n⬆️ *ترقية إلى مشرف*\n👤 الأعضاء: ${who}${actor ? `\n🛡️ بواسطة: @${numOf(actor)}` : ""}`,
      actor ? [...list, actor] : list,
    );
    log.info(`[${botLabel}] المراقبة: ترقية في ${groupJid}`);
    return true;
  },

  async onDemote({ sock, groupJid, participants, actor, botLabel }) {
    const list = [...new Set((participants || []).map(jidOf).filter(Boolean))];
    if (!list.length) return false;

    const who = list.map((j) => `@${numOf(j)}`).join("، ");
    await sendMonitor(
      sock,
      groupJid,
      `👁️ *مراقبة المجموعة*\n⬇️ *خفض من الإشراف*\n👤 الأعضاء: ${who}${actor ? `\n🛡️ بواسطة: @${numOf(actor)}` : ""}`,
      actor ? [...list, actor] : list,
    );
    log.info(`[${botLabel}] المراقبة: خفض في ${groupJid}`);
    return true;
  },
};
