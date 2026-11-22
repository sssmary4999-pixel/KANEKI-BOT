import { db } from "../../database/db.js";
import { antifeatures, antifeatureModules } from "../../Corleone/مضاد/index.js";

// المضادات ثلاثة أقسام:
//  • مضادات المجموعة: يتحكم بها مشرفو المجموعة، وإعدادها لكل مجموعة.
//  • مضادات البوت العامة: يتحكم بها رقم البوت نفسه (من نفّذ الأمر)، وإعدادها لكل رقم على حدة.
//  • إعدادات المالك: لا يراها ولا يتحكم بها إلا مالك البوت.
const GROUP_FEATURES = antifeatures.filter((a) => !a.global && a.mode !== "bot" && a.mode !== "owner");
const BOT_FEATURES = antifeatures.filter((a) => a.global);
// أدوات البوت: عناصر خاصة بالمجموعة يتحكم بها رقم البوت (مثل تشغيل/إيقاف).
const BOT_TOOLS = antifeatures.filter((a) => a.mode === "bot");
// إعدادات المالك: تظهر في لوحة المالك وحده.
const OWNER_FEATURES = antifeatures.filter((a) => a.mode === "owner");

/** الوحدة الخام لعنصر في اللوحة (لدوالّ status/run). */
const moduleOf = (flag) => antifeatureModules.find((m) => m.flag === flag);

/** أقسام لوحة المجموعة: المالك يرى إعداداته الخاصة معها، والمشرف لا يراها. */
const featuresFor = (isOwner) => (isOwner ? [...GROUP_FEATURES, ...OWNER_FEATURES] : GROUP_FEATURES);

// معرّفات الأزرار تُطابَق حرفياً في messageHandler، فتُسجَّل كاملة لا ببادئة.
const TOGGLE_NAMES = [...GROUP_FEATURES, ...OWNER_FEATURES].flatMap((a) => [`تفعيل_${a.flag}`, `تعطيل_${a.flag}`]);
const BOT_TOGGLE_NAMES = [...BOT_FEATURES, ...BOT_TOOLS].flatMap((a) => [`تفعيل_${a.flag}`, `تعطيل_${a.flag}`]);
// أوامر نصّية لأدوات البوت (تشغيل/ايقاف): رقم البوت لا يستطيع ضغط الأزرار فيكتبها.
const BOT_TOOL_COMMANDS = BOT_TOOLS.flatMap((a) => Object.keys(moduleOf(a.flag)?.commands || {}));
const SELECT_NAMES = [...GROUP_FEATURES, ...OWNER_FEATURES].map((a) => `اختر_${a.flag}`);
const MODE_NAMES = ["تفعيل-ازرار", "تفعيل-قائمه", "تعطيل-ازرار", "تعطيل-قائمه"];
const PAGE_NAMES = Array.from({ length: 50 }, (_, i) => `تفعيل-المزيد_${i + 1}`);

const FOOTER = "𝙱𝙾𝚃 𝚅𝙸𝚃𝙾 𝚅𝟹";

const T = {
  head: "🛡️ *لوحة المضادات*",
  btnTitle: "لوحة المضادات",
  mainPrompt: "اختر طريقة عرض الأقسام:",
  btnInteractive: "🎯 أزرار قابلة للضغط",
  btnDropdown: "📋 أزرار منسدلة",
  chooseCategory: "اختر القسم للتحكم به:",
  status: "الحالة",
  statusOn: "يعمل ✅",
  statusOff: "متوقف 🚫",
  btnOn: "✅ تفعيل",
  btnOff: "🚫 إيقاف",
  btnBack: "⬅️ رجوع",
  more: "➕ المزيد",
  deny: "❌ هذا الأمر لمشرفي المجموعة ومالك البوت فقط.",
  denyOwner: "❌ هذا الإعداد لمالك البوت وحده.",
  notFound: "❌ لا يوجد مضاد بهذا الاسم.",
  onOne: (n) => `✅ تم تفعيل *${n}*.`,
  offOne: (n) => `🚫 تم تعطيل *${n}*.`,
};

/** الرقم المجرّد: "123:5@s.whatsapp.net" -> "123". */
const numOf = (jid = "") => String(jid).split("@")[0].split(":")[0];

function find(target = "") {
  const q = String(target).toLowerCase();
  return antifeatures.find((a) => a.name.toLowerCase() === q || a.flag.toLowerCase() === q);
}

/** يبني رسالة تفاعلية: أزرار أو قائمة منسدلة، وإلا رسالة نصية. */
async function sendStoreMessage(sock, from, msg, sender, { title, text, buttons = [], sections = [], footer, image = null }) {
  const imagenRaw = image || global.botImages[Math.floor(Math.random() * global.botImages.length)];
  const imagenFinal = typeof imagenRaw === "string" ? { url: imagenRaw } : imagenRaw;
  const canalJid = global.my?.canal1;

  const contextInfo = {
    mentionedJid: [sender],
    forwardedNewsletterMessageInfo: { newsletterJid: canalJid, serverMessageId: -1 },
  };

  if (buttons.length === 0 && sections.length === 0) {
    const payload = { mentions: [sender], contextInfo };
    if (image) {
      payload.image = imagenFinal;
      payload.caption = text;
    } else {
      payload.text = text;
    }
    return await sock.sendMessage(from, payload, { quoted: msg });
  }

  return await sock.sendButtonMessage(from, text, buttons, {
    title: title || "",
    footer: footer || "",
    quoted: msg,
    image: imagenFinal,
    mentions: [sender],
    sections,
    contextInfo,
  });
}

/** الخطوة 1: اختيار طريقة العرض (أزرار أو قائمة منسدلة). */
function buildMainMenu() {
  return {
    text: `${T.head}\n\n${T.mainPrompt}`,
    buttons: [
      { text: T.btnInteractive, id: ".تفعيل-ازرار" },
      { text: T.btnDropdown, id: ".تفعيل-قائمه" },
    ],
  };
}

/** الخطوة 2أ: الأقسام كأزرار قابلة للضغط (بصفحات لئلا تتجاوز حدّ واتساب). */
function buildCategoriesButtons(list, page = 0) {
  const totalPages = Math.ceil(list.length / 2);
  const p = Math.min(Math.max(page, 0), Math.max(totalPages - 1, 0));
  const perPage = totalPages > 1 ? 2 : 3;
  const slice = list.slice(p * perPage, p * perPage + perPage);

  const buttons = slice.map((a) => ({ text: a.name, id: `.اختر_${a.flag}` }));
  if (p < totalPages - 1) buttons.push({ text: T.more, id: `.تفعيل-المزيد_${p + 1}` });
  else if (p > 0) buttons.push({ text: T.btnBack, id: ".تفعيل" });

  return { text: `${T.head}\n\n${T.chooseCategory}`, buttons };
}

/** الخطوة 2ب: الأقسام كقائمة منسدلة. */
function buildCategoriesDropdown(list) {
  return {
    text: `${T.head}\n\n${T.chooseCategory}`,
    sections: [
      {
        title: T.btnTitle,
        rows: list.map((a) => ({ title: a.name, description: a.flag, id: `.اختر_${a.flag}` })),
      },
    ],
  };
}

/** الخطوة 3: لوحة تحكم مضاد مجموعة: حالته وزرّ التبديل. */
function buildControlPanel(flag, from) {
  const q = String(flag).toLowerCase();
  const mod = antifeatures.find((a) => a.flag.toLowerCase() === q);
  if (!mod) return null;

  const isOn = !!db.getGroup(from)?.[mod.flag];
  return {
    text: `${T.head}\n\n📌 *${mod.name}*\n${T.status}: ${isOn ? T.statusOn : T.statusOff}`,
    buttons: [
      { text: isOn ? T.btnOff : T.btnOn, id: isOn ? `.تعطيل_${flag}` : `.تفعيل_${flag}` },
      { text: T.btnBack, id: ".تفعيل" },
    ],
  };
}

/** لوحة البوت: نصّية بسيطة، سطر واحد لكل إعداد مع أمره. */
function buildBotStatusPanel(botNum, from) {
  const s = db.getBotSettings(botNum);
  const bg = db.getBotGroup(botNum, from);

  const lines = BOT_FEATURES.map(
    (a) => `• ${a.name}: ${s[a.flag] ? T.statusOn : T.statusOff} ← *${s[a.flag] ? `تعطيل_${a.flag}` : `تفعيل_${a.flag}`}*`,
  );

  // أدوات البوت: وحدة «تشغيل-وايقاف» تعرض حالتها مع الأمر في سطر واحد.
  for (const tool of BOT_TOOLS) {
    const mod = moduleOf(tool.flag);
    if (typeof mod?.line === "function") lines.push(mod.line(!!bg.botOn));
  }

  return { text: `${T.head}\n\n🤖 *إعدادات البوت*\n\n${lines.join("\n")}` };
}

export default {
  name: ["تفعيل", "تعطيل", ...TOGGLE_NAMES, ...BOT_TOGGLE_NAMES, ...BOT_TOOL_COMMANDS, ...SELECT_NAMES, ...MODE_NAMES, ...PAGE_NAMES],
  description: "تفعيل وتعطيل المضادات بأزرار قابلة للضغط",
  category: "المجموعات",
  groupOnly: true,

  async run({ sock, from, msg, sender, botJid, args, cmdName, isAdmin, isMod, isOwner, fromMe, botMentioned, reply, react }) {
    const botNum = numOf(botJid);
    // رقم البوت الذي نفّذ الأمر بنفسه: لوحته خاصة به (مضادات الستوري فقط).
    const isBotSelf = !!fromMe;

    // منشن البوت: أي عضو يعرض لوحة إعدادات البوت بلا صلاحيات إشراف.
    if (botMentioned && !isBotSelf) {
      await react("🛡️");
      return await sendStoreMessage(sock, from, msg, sender, {
        text: buildBotStatusPanel(botNum, from).text,
        image: Array.isArray(global.botImages) && global.botImages.length
          ? global.botImages[Math.floor(Math.random() * global.botImages.length)]
          : null,
      });
    }

    if (!isBotSelf && !isAdmin && !isMod && !isOwner) return await reply({ text: T.deny });

    const name = String(cmdName || "").toLowerCase();
    const panel = (data) =>
      sendStoreMessage(sock, from, msg, sender, { ...data, title: T.btnTitle, footer: FOOTER });

    // صورة عشوائية من صور البوت لترويسة اللوحة.
    const pickBotImage = () =>
      Array.isArray(global.botImages) && global.botImages.length
        ? global.botImages[Math.floor(Math.random() * global.botImages.length)]
        : null;
    const botPanel = (text) => sendStoreMessage(sock, from, msg, sender, { text, image: pickBotImage() });

    // رقم البوت: لوحة نصّية مباشرة، بلا قائمة أقسام وبلا أزرار (لا يستطيع ضغطها).
    if (isBotSelf) {
      // أمر نصّي لأداة بوت (تشغيل/ايقاف): يُطابَق بالاسم لا بالعلَم.
      const toolCmd = BOT_TOOLS.find((a) => moduleOf(a.flag)?.commands?.[name] !== undefined);
      if (toolCmd) {
        const mod = moduleOf(toolCmd.flag);
        const on = mod.commands[name];
        const res = await mod.run({ sock, from, on, botNum });
        if (!res.changed) return await botPanel(res.text);
        await react(on ? "🟢" : "🔴");
        return await botPanel(`${res.text}\n\n${buildBotStatusPanel(botNum, from).text}`);
      }

      const flag = name.replace(/^(تفعيل|تعطيل)_?/, "") || String(args[0] || "").toLowerCase();
      const on = !name.startsWith("تعطيل");

      // أدوات البوت بصيغة علَم (تعطيل_botOn/تفعيل_botOn).
      const tool = BOT_TOOLS.find((a) => a.flag.toLowerCase() === flag);
      if (tool) {
        const mod = moduleOf(tool.flag);
        const res = await mod.run({ sock, from, on, botNum });
        if (!res.changed) return await botPanel(res.text);
        await react(on ? "🟢" : "🔴");
        return await botPanel(`${res.text}\n\n${buildBotStatusPanel(botNum, from).text}`);
      }

      const isGlobalFlag = (t) => BOT_FEATURES.some((a) => a.flag.toLowerCase() === String(t).toLowerCase());
      if (flag && isGlobalFlag(flag)) {
        const mod = find(flag);
        db.setBotSettings(botNum, { [mod.flag]: on });
        await react(on ? "✅" : "🚫");
        const data = buildBotStatusPanel(botNum, from);
        return await botPanel(`${on ? T.onOne(mod.name) : T.offOne(mod.name)}\n\n${data.text}`);
      }

      await react("🛡️");
      return await botPanel(buildBotStatusPanel(botNum, from).text);
    }

    // مشرف/مالك: لوحة مضادات المجموعة.

    // الخطوة 1: طريقة العرض.
    if ((name === "تفعيل" || name === "تعطيل") && !args[0]) {
      await react("📋");
      return await panel(buildMainMenu());
    }

    // الخطوة 2أ: الأقسام كأزرار.
    if (name === "تفعيل-ازرار" || name === "تعطيل-ازرار") {
      await react("🎯");
      return await panel(buildCategoriesButtons(featuresFor(isOwner), 0));
    }

    // الخطوة 2ب: الأقسام كقائمة منسدلة.
    if (name === "تفعيل-قائمه" || name === "تعطيل-قائمه") {
      await react("📋");
      return await panel(buildCategoriesDropdown(featuresFor(isOwner)));
    }

    // تنقّل بين صفحات الأقسام.
    if (name.startsWith("تفعيل-المزيد_")) {
      await react("➕");
      return await panel(buildCategoriesButtons(featuresFor(isOwner), Number(name.split("_").pop()) || 0));
    }

    // الخطوة 3: لوحة تحكم مضاد.
    if (name.startsWith("اختر_")) {
      const target = name.replace("اختر_", "").toLowerCase();
      // إعدادات المالك لا تُفتح لغيره.
      if (OWNER_FEATURES.some((a) => a.flag.toLowerCase() === target) && !isOwner) return await reply({ text: T.denyOwner });
      const ctrl = buildControlPanel(name.replace("اختر_", ""), from);
      if (!ctrl) return await reply({ text: T.notFound });
      await react("⚙️");
      return await panel(ctrl);
    }

    // تبديل الحالة: من زر (تفعيل_<flag>) أو نص (.تفعيل <flag>).
    const on = !name.startsWith("تعطيل");
    let target = name.replace(/^(تفعيل|تعطيل)_?/, "");
    if (!target && args[0]) target = String(args[0]).toLowerCase();

    const mod = find(target);
    // مضادات الستوري يتحكم بها رقم البوت وحده، لا مشرفو المجموعة.
    if (!mod || mod.global) {
      const names = featuresFor(isOwner).map((a) => `${a.flag} (${a.name})`).join("، ");
      return await reply({ text: `${T.notFound}\n> المتاح: ${names}` });
    }
    // إعدادات المالك لا يُبدّلها غيره.
    if (mod.mode === "owner" && !isOwner) return await reply({ text: T.denyOwner });

    db.setGroup(from, { [mod.flag]: on });
    await react(on ? "✅" : "🚫");

    const ctrl = buildControlPanel(mod.flag, from);
    const confirm = on ? T.onOne(mod.name) : T.offOne(mod.name);
    return await panel({ ...ctrl, text: `${confirm}\n\n${ctrl.text}` });
  },
};
