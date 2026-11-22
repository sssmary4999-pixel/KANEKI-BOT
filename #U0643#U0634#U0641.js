import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// مجلد الإضافات مشتق من موقع هذا الملف: Famiglia/plugins/مالك/كشف.js
const PLUGINS_DIR = path.resolve(__dirname, "..");
// المسار كما يراه المستخدم في المستودع.
const PLUGINS_LABEL = "Famiglia/plugins";

function extractNames(content) {
  const names = [];

  const arrayMatches = content.match(/name\s*:\s*\[([^\]]+)\]/g);
  if (arrayMatches) {
    arrayMatches.forEach((m) => {
      const inner = m.match(/\[([^\]]+)\]/);
      if (inner) {
        const items = inner[1].match(/['"]([^'"]+)['"]/g);
        if (items) items.forEach((i) => names.push(i.replace(/['"]/g, "").trim()));
      }
    });
  }

  const stringMatches = content.match(/name\s*:\s*['"]([^'"]+)['"]/g);
  if (stringMatches) {
    stringMatches.forEach((m) => {
      const ex = m.match(/['"]([^'"]+)['"]/);
      if (ex) names.push(ex[1].trim());
    });
  }

  return [...new Set(names)];
}

export default {
  name: ["كشف"],
  description: "عرض قائمة الأوامر أو الكود المصدري لأمر معين",
  category: "المطور",
  ownerOnly: true,

  async run(ctx) {
    const { sock: conn, from, msg: m, reply, args } = ctx;

    if (args && args.length > 0) {
      const input = args[0].toLowerCase().trim();
      if (!isNaN(input)) {
        return await showByNumber(parseInt(input), m, conn, from, reply);
      }
      return await showByName(input, m, conn, from, reply);
    }
    return await showAll(m, conn, from, reply);
  },
};

async function showByNumber(num, m, conn, from, reply) {
  try {
    const commandList = await getCommandList();
    if (commandList.length === 0) return await reply({ text: "❌ لا توجد أوامر محملة." });
    const found = commandList.find((cmd) => cmd.number === num);
    if (!found) {
      return await reply({ text: `❌ لا يوجد أمر بالرقم ${num}.\n📊 المجموع: ${commandList.length} أمر` });
    }
    const code = await getCommandCode(found.command, found.fullPath);
    if (code) {
      await sendCode(m, conn, from, found.command, code, found.realPath, reply);
    } else {
      await reply({ text: `❌ لم يتم العثور على الكود المصدري للأمر: ${found.command}` });
    }
  } catch (error) {
    console.error("[ showByNumber ]", error);
    await reply({ text: `❌ حدث خطأ:\n${error.message}` });
  }
}

async function showByName(name, m, conn, from, reply) {
  try {
    const rootDir = PLUGINS_DIR;
    const results = [];

    function walk(dir) {
      try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          if (item.isDirectory()) {
            walk(fullPath);
          } else if (item.isFile() && item.name.endsWith(".js")) {
            try {
              const content = fs.readFileSync(fullPath, "utf-8");
              const commandNames = extractNames(content);
              const matched = commandNames.some((n) => n.toLowerCase() === name.toLowerCase());
              if (matched) {
                const relPath = path.relative(rootDir, fullPath);
                results.push({
                  fileName: item.name,
                  commandName: commandNames[0] || item.name.replace(".js", ""),
                  names: commandNames,
                  repoPath: path.posix.join(PLUGINS_LABEL, relPath),
                  fullPath: fullPath,
                  content: content,
                });
              }
            } catch (e) {}
          }
        }
      } catch (e) {}
    }

    if (fs.existsSync(rootDir)) walk(rootDir);

    if (results.length > 0) {
      if (results.length > 1) {
        let text = `🔍 *نتائج البحث عن "${name}":*\n\n`;
        results.forEach((result, index) => {
          text += `📌 *${index + 1}. ${result.commandName}*\n`;
          text += `   📂 المسار: \`${result.repoPath}\`\n`;
          text += `   📝 الأسماء: ${result.names.join(", ")}\n\n`;
        });
        text += `\n💡 استخدم \`.كشف ${results[0].commandName}\` لعرض الكود`;
        return await reply({ text });
      }
      const result = results[0];
      return await sendCode(m, conn, from, result.commandName, result.content, result.repoPath, reply);
    }

    await reply({ text: `❌ لا يوجد أمر باسم "${name}".\n💡 استخدم \`.كشف\` لعرض جميع الأوامر.` });
  } catch (error) {
    console.error("[ showByName ]", error);
    await reply({ text: `❌ حدث خطأ:\n${error.message}` });
  }
}

async function showAll(m, conn, from, reply) {
  try {
    const commandList = await getCommandList();
    if (commandList.length === 0) return await reply({ text: "❌ لا توجد أوامر محملة." });

    let text = `╭──〔 📋 قائمة الأوامر 〕\n│\n`;
    let total = 0;
    let counter = 0;
    const byFolder = {};
    commandList.forEach((cmd) => {
      const folder = cmd.folder || "plugins";
      if (!byFolder[folder]) byFolder[folder] = [];
      byFolder[folder].push(cmd);
    });

    const sortedFolders = Object.keys(byFolder).sort((a, b) => a.localeCompare(b, "ar"));
    for (const folder of sortedFolders) {
      const commands = byFolder[folder];
      text += `├─ 📂 ${folder} (${commands.length})\n`;
      total += commands.length;
      commands.sort((a, b) => a.command.localeCompare(b.command, "ar"));
      for (const cmd of commands) {
        counter++;
        text += `│  ${counter}. ${cmd.command}\n`;
      }
    }
    text += `│\n╰─〔 📊 المجموع: ${total} أمر 〕`;

    if (text.length > 4000) {
      const parts = [];
      let current = "";
      for (const line of text.split("\n")) {
        if ((current + line + "\n").length > 4000) {
          parts.push(current);
          current = "";
        }
        current += line + "\n";
      }
      if (current) parts.push(current);
      for (const part of parts) await reply({ text: part });
    } else {
      await reply({ text });
    }
  } catch (error) {
    console.error("[ showAll ]", error);
    await reply({ text: `❌ حدث خطأ:\n${error.message}` });
  }
}

async function getCommandList() {
  const commandList = [];
  let counter = 0;
  const baseDir = PLUGINS_DIR;
  if (!fs.existsSync(baseDir)) return commandList;

  function scanDir(dir, currentFolder = "") {
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      const files = items.filter((item) => item.isFile() && item.name.endsWith(".js"));
      files.sort((a, b) => a.name.localeCompare(b.name, "ar"));
      const folderName = currentFolder || path.basename(dir);

      for (const file of files) {
        counter++;
        const fileName = file.name.replace(".js", "");
        const relPath = path.relative(baseDir, dir);

        commandList.push({
          number: counter,
          command: fileName,
          realPath: path.posix.join(PLUGINS_LABEL, relPath, file.name),
          folder: folderName,
          fullPath: path.join(dir, file.name),
        });
      }

      const dirs = items.filter((item) => item.isDirectory());
      for (const dirItem of dirs) {
        scanDir(path.join(dir, dirItem.name), dirItem.name);
      }
    } catch (e) {
      console.log("خطأ في قراءة المجلد:", dir, e.message);
    }
  }

  scanDir(baseDir);
  return commandList;
}

async function getCommandCode(commandName, fullPath) {
  try {
    if (fullPath && fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath, "utf-8");
    }

    const baseDir = PLUGINS_DIR;
    if (!fs.existsSync(baseDir)) return null;

    function search(dir) {
      try {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
          const filePath = path.join(dir, file.name);
          if (file.isDirectory()) {
            const result = search(filePath);
            if (result) return result;
          } else if (file.isFile() && file.name.endsWith(".js")) {
            try {
              const content = fs.readFileSync(filePath, "utf-8");
              const names = extractNames(content);
              if (names.some((n) => n.toLowerCase() === commandName.toLowerCase())) return content;
              if (file.name === `${commandName}.js`) return content;
            } catch (e) {}
          }
        }
        return null;
      } catch (err) {
        return null;
      }
    }
    return search(baseDir);
  } catch (error) {
    console.error("[ getCommandCode ]", error);
    return null;
  }
}

async function sendCode(m, conn, from, commandName, code, filePath, reply) {
  try {
    const cleanCode = code
      .replace(/^```(?:js|javascript)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const codeBlocks = [
      {
        highlightType: 6,
        codeContent: cleanCode,
      },
    ];

    const pathInfo = filePath ? `\n📂 المسار: ${filePath}` : "";

    await conn.relayMessage(
      from,
      {
        botForwardedMessage: {
          message: {
            richResponseMessage: {
              messageType: 1,
              submessages: [
                {
                  messageType: 2,
                  messageText: `📄 الكود المصدري للأمر: ${commandName}.js${pathInfo}`,
                },
                {
                  messageType: 5,
                  codeMetadata: {
                    codeLanguage: "javascript",
                    codeBlocks: codeBlocks,
                  },
                },
              ],
              contextInfo: {
                isForwarded: true,
                forwardingScore: 1,
                forwardOrigin: 4,
                forwardedAiBotMessageInfo: {
                  botJid: "867051314767696@bot",
                },
                mentionedJid: [m.key?.participant || from],
                quotedMessage: m.message,
              },
            },
          },
        },
      },
      { messageId: conn.generateMessageTag() }
    );
  } catch (error) {
    console.error("[ sendCode ]", error);
    await reply({ text: `❌ حدث خطأ أثناء عرض الكود:\n${error.message}` });
  }
}
