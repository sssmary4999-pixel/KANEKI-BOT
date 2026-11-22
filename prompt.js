import readline from "readline";

/**
 * موجّه إدخال بصدف الأسطر.
 *
 * نعيد استخدام واجهة واحدة لكل سؤال وتُصفّ الأسطر الواردة، فلا يُفقد جواب ولا
 * يُنسب لغير سؤاله حين يسلّم stdin أكثر من سطر دفعة واحدة (إدخال موصول بأنبوب،
 * أو طرفية لوحة استضافة، أو مستخدم يلصق الرقم في لحظة الاختيار نفسها). هذا ما
 * يجعل تدفّق الاقتران ينتظر رقم الهاتف فعلاً بدل أن يُحلّ بسطر قديم.
 */
function createPrompter(input = process.stdin, output = process.stdout) {
  const rl = readline.createInterface({ input, output });
  const buffered = [];
  let pending = null;

  rl.on("line", (line) => {
    const resolve = pending;
    if (resolve) {
      pending = null;
      resolve(line);
    } else {
      buffered.push(line);
    }
  });

  // نهاية الإدخال يجب أن تُحرّر السؤال المعلّق بقيمة null بدل التعليق للأبد.
  rl.on("close", () => {
    const resolve = pending;
    if (resolve) {
      pending = null;
      resolve(null);
    }
  });

  return {
    ask(question) {
      output.write(question);
      if (buffered.length > 0) return Promise.resolve(buffered.shift());
      return new Promise((resolve) => {
        pending = resolve;
      });
    },
    close() {
      rl.close();
    },
  };
}

/** يُبقي الأرقام فقط، فتُقبل أي صيغة: "+967 738 512 629" أو "967-738-512-629". */
export function cleanPhoneNumber(value) {
  return String(value ?? "").replace(/\D/g, "");
}

/** صيغة E.164 تسمح بـ8–15 رقماً. */
export function isValidPhoneNumber(value) {
  const digits = cleanPhoneNumber(value);
  return digits.length >= 8 && digits.length <= 15;
}

export async function askConnectionMethod() {
  const prompter = createPrompter();
  try {
    return await askConnectionMethodOn(prompter);
  } finally {
    prompter.close();
  }
}

export async function askPhoneNumber() {
  const prompter = createPrompter();
  try {
    return await askPhoneNumberOn(prompter);
  } finally {
    prompter.close();
  }
}

/**
 * اسأل عن الطريقة ورقم الهاتف عبر موجّه إدخال واحد.
 *
 * موجّهان منفصلان يُفقدان جواباً: إن لصق المستخدم الاختيار والرقم معاً (أو سلّمت
 * لوحة الاستضافة السطرين دفعة واحدة)، تخزّن واجهة readline الأولى السطر الثاني
 * وتُسقطه عند الإغلاق، فيُحلّ سؤال الرقم فارغاً. مشاركة الموجّه تحفظ ذلك السطر.
 */
export async function askPairingDetails() {
  const prompter = createPrompter();
  try {
    const method = await askConnectionMethodOn(prompter);
    if (method !== "1") return { method, phone: null };

    const phone = await askPhoneNumberOn(prompter);
    return { method, phone };
  } finally {
    prompter.close();
  }
}

async function askConnectionMethodOn(prompter) {
  console.log("");
  console.log(" ╔══════════════════════════════════╗");
  console.log(" ║  [1] رمز الاقتران (Pairing Code) ║");
  console.log(" ║  [2] رمز QR                      ║");
  console.log(" ╚══════════════════════════════════╝");

  for (;;) {
    const raw = await prompter.ask(" اختر طريقة الاتصال (1 أو 2): ");
    if (raw === null) return null;
    const choice = String(raw).trim();
    if (choice === "1" || choice === "2") return choice;
    console.log(" ⚠️  إدخال غير صالح — اكتب 1 أو 2.");
  }
}

async function askPhoneNumberOn(prompter) {
  console.log("");
  console.log(" أدخل رقم هاتفك مع رمز الدولة.");
  console.log(" يقبل كل الصيغ — بمسافات أو بدونها، بزائد (+) أو بدونه:");
  console.log("   +967 738 512 629   |   967738512629   |   (967) 738-512-629");

  for (;;) {
    const raw = await prompter.ask(" رقم الهاتف: ");
    if (raw === null) return null;
    if (isValidPhoneNumber(raw)) return cleanPhoneNumber(raw);
    console.log(" ⚠️  رقم غير صالح — يجب أن يحتوي على 8 إلى 15 رقماً.");
  }
}
