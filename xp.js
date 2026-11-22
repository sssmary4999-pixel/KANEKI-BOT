import { db } from "../database/db.js";

const CHAT_XP_MIN = 3;
const CHAT_XP_MAX = 8;
export const CHAT_XP_COOLDOWN_MS = 60 * 1000;
const COMMAND_XP = 5;

function xpForLevel(level) {
  return level * level * 100;
}

export function levelFromXp(xp) {
  let level = 0;
  while (xp >= xpForLevel(level + 1)) level++;
  return level;
}

export function xpProgress(xp) {
  const level = levelFromXp(xp);
  const currentFloor = xpForLevel(level);
  const nextFloor = xpForLevel(level + 1);
  return { level, xp, currentFloor, nextFloor, missing: nextFloor - xp };
}

/** مقدار الخبرة العشوائي لرسالة دردشة. */
export function chatXpAmount() {
  return Math.floor(Math.random() * (CHAT_XP_MAX - CHAT_XP_MIN + 1)) + CHAT_XP_MIN;
}

/** يمنح خبرة، ويعيد رقم المستوى الجديد عند الترقية، وإلا null. */
export function grantXp(jid, amount) {
  const user = db.getUser(jid);
  const before = levelFromXp(user.xp || 0);
  const xp = (user.xp || 0) + amount;
  db.setUser(jid, { xp });
  const after = levelFromXp(xp);
  if (after <= before) return null;

  return after;
}

/** خبرة الأمر الواحد، ويعيد رقم المستوى الجديد عند الترقية أو null. */
export function handleCommandXp(sender) {
  return grantXp(sender, COMMAND_XP);
}
