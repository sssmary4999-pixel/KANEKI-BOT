import { log } from "../logger.js";

const WINDOW_MS = 10_000;
const MAX_MESSAGES = 6;
const COOLDOWN_MS = 30_000;

const history = new Map();

function clean() {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [k, times] of history) {
    const kept = times.filter((t) => t > cutoff);
    if (kept.length === 0) history.delete(k);
    else history.set(k, kept);
  }
}

export default {
  name: "مضاد-سبام",
  flag: "antispam",

  async check({ sock, msg, from, sender, body, isBotAdmin, botLabel }) {
    if (!body) return false;

    const now = Date.now();
    if (history.size > 500) clean();

    const k = `${from}:${sender}`;
    const times = (history.get(k) || []).filter((t) => t > now - WINDOW_MS);

    // فترة سماح بعد العقوبة حتى لا نطارد العضو في كل رسالة.
    if (times.some((t) => t < 0)) return false;

    times.push(now);
    history.set(k, times);

    if (times.length <= MAX_MESSAGES) return false;

    history.set(k, [-now]);

    try {
      if (isBotAdmin) {
        await sock.groupParticipantsUpdate(from, [sender], "remove");
        await sock.sendMessage(from, {
          text: `🚫 *مضاد السبام*\n> طُرد @${sender.split("@")[0]} لإرسال ${MAX_MESSAGES}+ رسائل في ${WINDOW_MS / 1000} ثوانٍ.`,
          mentions: [sender],
        });
      } else {
        await sock.sendMessage(from, {
          text: `⚠️ *مضاد السبام*\n> @${sender.split("@")[0]} يرسل رسائل بسرعة، لكني لست مشرفاً — ارفعني لأتمكن من الطرد.`,
          mentions: [sender],
        });
      }

      log.info(`[${botLabel}] مضاد السبام: ${sender.split("@")[0]} في ${from}`);
      setTimeout(() => history.delete(k), COOLDOWN_MS);
    } catch (e) {
      log.error(`مضاد السبام: ${e.message}`);
    }

    return true;
  },
};
