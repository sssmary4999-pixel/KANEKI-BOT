import chalk from "chalk";
import config from "./settings.js";

const { botName } = config;

// ═══════════════════════════════════════════════════════════
//  لوحة الألوان
// ═══════════════════════════════════════════════════════════
const BLUE = "#2979FF"; // إطار الصندوق
const LIGHT = "#82B1FF"; // النصوص الفاتحة على الخلفية الداكنة

const B = chalk.hex(BLUE);
const BB = chalk.hex(BLUE).bold;
const LB = chalk.hex(LIGHT);
const LBB = chalk.hex(LIGHT).bold;
const W = chalk.white;
const WB = chalk.white.bold;
const DIM = chalk.dim;
const Y = chalk.yellow;
const YB = chalk.yellowBright;
const G = chalk.green;
const GB = chalk.greenBright;
const R = chalk.red;
const RB = chalk.red.bold;
const C = chalk.cyan;
const CY = chalk.hex("#00E5FF");
const MAG = chalk.hex("#E040FB");

const WIDTH = 56; // العرض الداخلي للصندوق
const LABEL_W = 12; // عرض عمود العنوان

// ═══════════════════════════════════════════════════════════
//  أدوات حساب العرض المرئي (تتجاهل أكواد الألوان وتحسب الإيموجي)
// ═══════════════════════════════════════════════════════════
const ANSI = /\u001b\[[0-9;]*m/g;

function stripAnsi(s) {
  return String(s ?? "").replace(ANSI, "");
}

function charWidth(cp) {
  if (cp === 0x200d) return 0; // ZWJ
  if (cp >= 0xfe00 && cp <= 0xfe0f) return 0; // محددات التنويع
  if (cp >= 0x1f3fb && cp <= 0x1f3ff) return 0; // معدّلات لون البشرة
  if (cp >= 0x1f000) return 2; // الإيموجي الحديثة
  if (cp >= 0x2600 && cp <= 0x27bf) return 2;
  if (cp >= 0x2b00 && cp <= 0x2bff) return 2;
  if (cp >= 0x231a && cp <= 0x231b) return 2;
  if (cp >= 0x23e9 && cp <= 0x23fa) return 2;
  if (cp >= 0x25fd && cp <= 0x25fe) return 2;
  if (cp >= 0x2648 && cp <= 0x2653) return 2;
  if (cp === 0x267f || cp === 0x2693) return 2;
  if (cp >= 0x26aa && cp <= 0x26ab) return 2;
  if (cp >= 0x26bd && cp <= 0x26be) return 2;
  if (cp >= 0x26c4 && cp <= 0x26c5) return 2;
  if (cp === 0x26ce || cp === 0x26d4 || cp === 0x26ea) return 2;
  if (cp >= 0x26f2 && cp <= 0x26f3) return 2;
  if (cp === 0x26f5 || cp === 0x26fa || cp === 0x26fd) return 2;
  if (cp === 0x2705 || cp === 0x2728) return 2;
  if (cp >= 0x270a && cp <= 0x270b) return 2;
  if (cp === 0x274c || cp === 0x274e) return 2;
  if (cp >= 0x2753 && cp <= 0x2755) return 2;
  if (cp === 0x2757) return 2;
  if (cp >= 0x2795 && cp <= 0x2797) return 2;
  if (cp === 0x27b0 || cp === 0x27bf) return 2;
  if (cp >= 0x2b1b && cp <= 0x2b1c) return 2;
  if (cp === 0x2b50 || cp === 0x2b55) return 2;
  // الحروف العريضة (CJK وغيرها)
  if (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0x303e) ||
    (cp >= 0x3041 && cp <= 0x33ff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0xa000 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe6f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6)
  ) {
    return 2;
  }
  return 1;
}

function visWidth(s) {
  let w = 0;
  for (const ch of stripAnsi(s)) w += charWidth(ch.codePointAt(0));
  return w;
}

function padEndVis(s, width) {
  const gap = width - visWidth(s);
  return gap > 0 ? s + " ".repeat(gap) : s;
}

/** يقتطع النص ليدخل في العرض المطلوب (يتجاهل أكواد الألوان). */
function fit(s, width) {
  const raw = String(s ?? "");
  if (visWidth(raw) <= width) return raw;

  // نحجز مكاناً لنقاط القطع حتى لا يتجاوز السطر العرض المسموح.
  const limit = Math.max(0, width - 1);
  let out = "";
  let w = 0;
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === "\u001b") {
      const m = raw.slice(i).match(/^\u001b\[[0-9;]*m/);
      if (m) {
        out += m[0];
        i += m[0].length;
        continue;
      }
    }
    const cp = raw.codePointAt(i);
    const ch = String.fromCodePoint(cp);
    const cw = charWidth(cp);
    if (w + cw > limit) break;
    out += ch;
    w += cw;
    i += ch.length;
  }
  return out + "…" + "\u001b[0m";
}

/** يوحّد النص في سطر واحد حتى لا يكسر الصندوق. */
function oneLine(s) {
  return String(s ?? "")
    .replace(/\s*\n\s*/g, " ⏎ ")
    .trim();
}

function centerVis(text, width) {
  const len = visWidth(text);
  const left = Math.max(0, Math.floor((width - len) / 2));
  const right = Math.max(0, width - len - left);
  return " ".repeat(left) + text + " ".repeat(right);
}

function ts() {
  return new Date().toLocaleTimeString("en-GB");
}

/** الأولوية لرقم الهاتف، ولا يُعرض الاسم إلا إن غاب الرقم. */
function displayUser(number, name) {
  const num = stripAnsi(String(number ?? "")).split("@")[0].split(":")[0].trim();
  if (num && /\d/.test(num)) return /^\+/.test(num) ? num : `+${num}`;
  const fallback = stripAnsi(String(name ?? "")).trim();
  return fallback || "غير معروف";
}

// ═══════════════════════════════════════════════════════════
//  الشعار (بانر)
// ═══════════════════════════════════════════════════════════
export async function printBanner() {
  const top = BB("╔" + "═".repeat(WIDTH) + "╗");
  const bottom = BB("╚" + "═".repeat(WIDTH) + "╝");
  const empty = B("║") + " ".repeat(WIDTH) + B("║");
  const row = (colored) => B("║") + centerVis(colored, WIDTH) + B("║");

  console.log();
  console.log(top);
  console.log(empty);
  console.log(row(LBB(botName)));
  console.log(empty);
  console.log(row(DIM("WhatsApp Bot System V3")));
  console.log(empty);
  console.log(bottom);
  console.log();
}

// ═══════════════════════════════════════════════════════════
//  وسوم الحالة
// ═══════════════════════════════════════════════════════════
const tag = {
  info: chalk.bgHex("#7B2FBE").white.bold("  INFO  "),
  ok: chalk.bgHex("#00C853").white.bold("   OK   "),
  warn: chalk.bgHex("#FF6F00").white.bold("  WARN  "),
  error: chalk.bgHex("#D50000").white.bold(" ERROR  "),
  conn: chalk.bgHex("#1A237E").white.bold("  CONN  "),
  bot: chalk.bgHex("#263238").white.bold("  BOT   "),
};

// ═══════════════════════════════════════════════════════════
//  صف داخل الصندوق: عنوان باهت + قيمة ملوّنة
// ═══════════════════════════════════════════════════════════
function row(label, value, color = LB) {
  const head = `  ${padEndVis(label, LABEL_W)} :: `;
  const avail = Math.max(1, WIDTH - visWidth(head));
  const raw = String(value ?? "");
  const val = fit(raw, avail);
  // القيمة الملوّنة مسبقاً تُترك كما هي، وإلا تُصبغ بلون الصف.
  const colored = /\u001b\[/.test(raw) ? val : color(val);
  const spaces = Math.max(0, WIDTH - visWidth(head) - visWidth(val));
  return B("║") + DIM(head) + colored + " ".repeat(spaces) + B("║");
}

// ═══════════════════════════════════════════════════════════
//  سطر خطأ مختصر — بلا صندوق منفصل
// ═══════════════════════════════════════════════════════════
function errorLine(msg, file) {
  const where = file ? DIM(` (${file})`) : "";
  console.log(`${DIM(`[${ts()}]`)} ${tag.error}  ${RB(oneLine(msg))}${where}`);
}

export const log = {
  info: (msg) => console.log(`${DIM(`[${ts()}]`)} ${tag.info}  ${W(msg)}`),
  ok: (msg) => console.log(`${DIM(`[${ts()}]`)} ${tag.ok}  ${G(msg)}`),
  warn: (msg) => console.log(`${DIM(`[${ts()}]`)} ${tag.warn}  ${Y(msg)}`),
  conn: (msg) => console.log(`${DIM(`[${ts()}]`)} ${tag.conn}  ${C(msg)}`),
  bot: (msg) => console.log(`${DIM(`[${ts()}]`)} ${tag.bot}  ${chalk.hex("#B0BEC5")(msg)}`),

  error: (msg, file, stack) => {
    errorLine(msg, file);
    // السطر الأول من التتبّع يكفي للتشخيص — لا نطبع صندوقاً كاملاً.
    if (stack) {
      const first = String(stack).split("\n").find((l) => l.trim().startsWith("at "));
      if (first) console.log(`${" ".repeat(9)}${DIM(first.trim())}`);
    }
  },

  // ═════════════════════════════════════════════════════════
  //  الصندوق الوحيد — كل شيء داخله، لا نص خارجه.
  //  الشريط العلوي أزرق سماوي بخلفية سوداء النص، ويحمل رقم البوت نفسه.
  // ═════════════════════════════════════════════════════════
  message({ groupName, userName, userNumber, messageType, content, isGroup = false, isCmd = false, botLabel = "MAIN", botNumber = "", command = "" }) {
    const isSub = /sub/i.test(String(botLabel));
    const tipoBot = isSub ? "SUB" : "MAIN";

    const usuario = displayUser(userNumber, userName);
    const lugar = isGroup ? groupName || "مجموعة" : "دردشة خاصة";
    const tipo = isCmd ? "⚡ أمر" : messageType || "نص";
    // للأوامر نعرض الأمر الذي كتبه المستخدم بدل نوع الرسالة.
    const tipoLabel = isCmd ? "⚡ الأمر" : "📝 النوع";
    const tipoValue = isCmd ? command || `⚡ ${content || "أمر"}` : tipo;
    const tipoColor = isCmd ? MAG : CY;
    const texto = content ? oneLine(content) : "(بلا نص)";

    const numeroBoton = String(botNumber ?? "").replace(/\D/g, "");

    const top = B("╔" + "═".repeat(WIDTH) + "╗");
    const mid = B("╠" + "═".repeat(WIDTH) + "╣");
    const bottom = B("╚" + "═".repeat(WIDTH) + "╝");

    const barText = `🕴🏻 ${botName} ${tipoBot}${numeroBoton ? ` +${numeroBoton}` : ""}`;
    // أسود صافٍ بلا bold: الطرفيات تُفسّر bold بأنه تفتيح للون، فـ"أسود عريض"
    // يظهر رمادياً/أبيض على الخلفية السماوية. الأسود الأساسي وحده مقروء دائماً.
    const bar = chalk.bgCyan.black(centerVis(barText, WIDTH));

    console.log();
    console.log(top);
    console.log(B("║") + bar + B("║"));
    console.log(mid);
    console.log(row("⏰ الوقت", ts(), LB));
    console.log(row("📱 المرسل", usuario, WB));
    console.log(row(tipoLabel, tipoValue, tipoColor));
    console.log(row("👥 المجموعة", lugar, LB));
    console.log(row("💬 الرسالة", texto, isCmd ? MAG : WB));
    console.log(bottom);
  },

  pairingCode(code) {
    const pretty = String(code || "").match(/.{1,4}/g)?.join("-") ?? String(code || "");
    const center = (colored) => B("║") + centerVis(colored, WIDTH) + B("║");
    console.log();
    console.log(B("╔" + "═".repeat(WIDTH) + "╗"));
    console.log(center(""));
    console.log(center(LBB("رمز الاقتران (PAIRING CODE)")));
    console.log(center(GB(pretty)));
    console.log(center(""));
    console.log(B("╚" + "═".repeat(WIDTH) + "╝"));
  },

  // ═════════════════════════════════════════════════════════
  //  لا يطبع بنفسه — يفوّض الأمر إلى log.message
  //  حتى يخرج كل شيء في صندوق واحد.
  // ═════════════════════════════════════════════════════════
  cmdExec({ cmdName, sender, botLabel = "MAIN", groupName, userName, userNumber, messageType, content, isGroup, botNumber = "" }) {
    const cmd = cmdName ? `.${cmdName}` : "";
    log.message({
      groupName,
      userName: userName ?? sender,
      userNumber: userNumber ?? sender,
      messageType,
      content: content ?? cmd,
      command: cmd,
      isGroup: isGroup ?? false,
      isCmd: true,
      botLabel,
      botNumber,
    });
  },
};

export default log;
