import { log } from "../logger.js";

// إيموجي التفاعل — يُختار عشوائياً لكل حالة.
export const EMOJIS = [
  "💚", "😂", "🤣", "😍", "😎", "🔥", "❤️", "💀", "👻", "🤡", "🙈",
  "😅", "🤔", "👍", "👀", "✨", "💯", "🥲", "🫣", "🙃", "😴",
  "🤯", "🤨", "😳", "😈", "🥵", "🥶", "😇", "🫡", "😭", "🫥",
  "👽", "😬", "🤖", "💫", "🎃", "👑", "😐", "🤓", "😤", "😌",
  "🙄", "🥱", "👊", "🤝", "🙏", "😻", "💔", "🎉", "🌚", "🌝",
  "🌟", "🧠", "🦾", "🧸", "🐸", "🦄", "🐺", "🕊️", "📿", "🥷",
];

/** صاحب الحالة: `participant` عند البث، وإلا المعرّف البديل. */
export function senderOf(msg) {
  const k = msg?.key || {};
  return k.participant || k.participantAlt || k.remoteJidAlt || null;
}

export function numOf(jid = "") {
  return String(jid).split("@")[0].split(":")[0];
}

/** حالة البوت نفسه لا تُشاهد ولا يُتفاعل معها. */
export function isOwnStatus(sock, msg) {
  if (msg?.key?.fromMe) return true;
  const sender = senderOf(msg);
  if (!sender) return true;
  return numOf(sender) === numOf(sock?.user?.id || "");
}

// إيصال القراءة لا يُرسل مرتين لنفس الحالة، فقد يُفعَّل المضادان معاً.
const viewed = new Set();
const MAX_VIEWED = 500;

export async function viewStatus(sock, msg) {
  const id = msg?.key?.id;
  if (id && viewed.has(id)) return false;

  if (id) {
    viewed.add(id);
    if (viewed.size > MAX_VIEWED) viewed.delete(viewed.values().next().value);
  }

  await sock.readMessages([msg.key]);
  return true;
}

export default {
  name: "مشاهدة-ستوري",
  flag: "statusview",
  global: true,

  async onStatus({ sock, msg, botLabel }) {
    if (!msg?.message || msg.message.reactionMessage) return false;
    if (isOwnStatus(sock, msg)) return false;

    await viewStatus(sock, msg);
    log.info(`[${botLabel}] مشاهدة-ستوري: شوهدت حالة ${numOf(senderOf(msg))}`);
    return true;
  },
};
