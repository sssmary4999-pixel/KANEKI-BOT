import { log } from "../logger.js";
import { EMOJIS, senderOf, numOf, isOwnStatus, viewStatus } from "./مشاهدة-ستوري.js";

export default {
  name: "مشاهدة-تفاعل-ستوري",
  flag: "statusviewreact",
  global: true,

  async onStatus({ sock, msg, botLabel }) {
    if (!msg?.message || msg.message.reactionMessage) return false;
    if (isOwnStatus(sock, msg)) return false;

    await viewStatus(sock, msg);

    const sender = senderOf(msg);
    const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    await sock.sendMessage(
      "status@broadcast",
      { react: { text: emoji, key: msg.key } },
      { statusJidList: [sender, sock.user?.id].filter(Boolean) },
    );

    log.info(`[${botLabel}] مشاهدة-تفاعل-ستوري: ${emoji} على حالة ${numOf(sender)}`);
    return true;
  },
};
