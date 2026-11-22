import { db } from "../../database/db.js";
import { claimOnce, getAllSockets } from "../../Corleone/subbotManager.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const numOf = (jid = "") => jid.split("@")[0].split(":")[0];

export default {
  name: ["اذاعة"],
  description: "يرسل رسالة إلى جميع المجموعات التي بها بوتات",
  category: "المالك",
  ownerOnly: true,
  groupOnly: true,

  async run({ sock, from, msg, reply, text }) {

    if (!text) return reply({ text: ( "⚠️ اكتب الرسالة.\nمثال: `.bc مرحباً بالجميع`") });
    if (!claimOnce(`bc:${msg.key.id}`)) return;

    const sent = await reply({ text: ( "📢 `بث`\n> ⏤͟͟͞͞⊱☕︎ *الحالة:* جارٍ جمع البوتات...") });
    const edit = (t) => sock.sendMessage(from, { text: t, edit: sent.key });

    const bots = getAllSockets().filter((b) => b?.user);

    // 1) كل البوتات تسرد مجموعاتها في الوقت نفسه
    const listas = await Promise.allSettled(
      bots.map(async (bot) => ({
        bot,
        grupos: Object.values(await bot.groupFetchAllParticipating()),
      }))
    );

    const grupos = new Map(); // gid -> Map(numeroBot -> socket)
    for (const r of listas) {
      if (r.status !== "fulfilled") continue;
      const { bot, grupos: gs } = r.value;
      for (const g of gs) {
        if (!grupos.has(g.id)) grupos.set(g.id, new Map());
        grupos.get(g.id).set(numOf(bot.user.id), bot);
      }
    }

    // 2) التوزيع: الرئيسي إن وُجد، وإلا البوت الأقل حملاً
    const colas = new Map();
    let skip = 0;
    const orden = [...grupos].sort((a, b) => a[1].size - b[1].size);

    for (const [gid, botsEnGrupo] of orden) {
      if (gid === from) { skip++; continue; }

      const primary = db.getPrimary(gid);
      let emisor = null;

      if (primary) {
        emisor = botsEnGrupo.get(primary) ?? null;
      } else {
        let min = Infinity;
        for (const b of botsEnGrupo.values()) {
          const carga = colas.get(b)?.length ?? 0;
          if (carga < min) { min = carga; emisor = b; }
        }
      }

      if (!emisor) { skip++; continue; }
      if (!colas.has(emisor)) colas.set(emisor, []);
      colas.get(emisor).push(gid);
    }

    const total = [...colas.values()].reduce((a, q) => a + q.length, 0);
    let ok = 0, fail = 0, hechos = 0;

    await edit(( `📢 \`بث\`\n> ⏤͟͟͞͞⊱☕︎ *جارٍ الإرسال:* 0/${total} (${colas.size} بوت)`));

    // 3) كل البوتات ترسل في الوقت نفسه
    await Promise.all(
      [...colas].map(async ([bot, cola]) => {
        for (const gid of cola) {
          try { await bot.sendMessage(gid, { text }); ok++; } catch { fail++; }
          hechos++;
          if (hechos % 25 === 0) {
            edit(( `📢 \`بث\`\n> ⏤͟͟͞͞⊱☕︎ *التقدّم:* ${hechos}/${total}`)).catch(() => {});
          }
          await sleep(2000 + Math.random() * 2000);
        }
      })
    );

    await edit(
      ( `📢 \`انتهى البث\`\n`) +
      ( `> ✅ *أُرسلت:* ${ok}\n`) +
      ( `> ❌ *فشلت:* ${fail}\n`) +
      ( `> ⏭️ *تم تخطيها:* ${skip}`)
    );
  },
};