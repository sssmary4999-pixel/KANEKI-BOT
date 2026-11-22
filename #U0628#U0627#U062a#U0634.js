import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// مجلد الإضافات مشتق من موقع هذا الملف: Famiglia/plugins/مالك/باتش.js
const PLUGINS_DIR = path.resolve(__dirname, "..");
// المسار كما يراه المستخدم في المستودع.
const PLUGINS_LABEL = "Famiglia/plugins";

export default {
  name: ["باتش"],
  description: "عرض قائمة الأوامر أو الكود المصدري لأمر معين",
  category: "المطور",
  ownerOnly: true,

  async run(ctx) {
    const { sock: conn, from, msg: m, reply, args } = ctx;

    if (args && args.length > 0) {
      const input = args[0].toLowerCase().trim();
      if (!isNaN(input)) {
        return await showCommandByNumber(parseInt(input), m, conn, from, reply);
      }
      return await showCommandByName(input, m, conn, from, reply);
    }
    return await showAllCommands(m, conn, from, reply);
  },
};

async function showCommandByNumber(number, m, conn, from, reply) {
  try {
    const commandList = await getCommandList();
    if (commandList.length === 0) return await reply({ text: "❌ لا توجد أوامر محملة." });
    const foundCommand = commandList.find((cmd) => cmd.number === number);
    if (!foundCommand) {
      return await reply({ text: `❌ لا يوجد أمر بالرقم ${number}.\n📊 المجموع: ${commandList.length} أمر` });
    }
    const code = await getCommandCode(foundCommand.command, foundCommand.fullPath);
    if (code) {
      await sendRichCode(m, conn, from, foundCommand.command, code, foundCommand.realPath, reply);
    } else {
      await reply({ text: `❌ لم يتم العثور على الكود المصدري للأمر: ${foundCommand.command}` });
    }
  } catch (error) {
    console.error("[ showCommandByNumber ]", error);
    await reply({ text: `❌ حدث خطأ:\n${error.message}` });
  }
}

async function showCommandByName(name, m, conn, from, reply) {
  try {
    const pluginsPath = PLUGINS_DIR;
    let foundCommands = [];

    function searchInPlugins(dir) {
      try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          if (item.isDirectory()) {
            searchInPlugins(fullPath);
          } else if (item.isFile() && item.name.endsWith(".js")) {
            const fileName = item.name.replace(".js", "");
            if (fileName.toLowerCase() === name.toLowerCase()) {
              const relativePath = path.relative(pluginsPath, fullPath);
              foundCommands.push({
                fileName: item.name,
                commandName: fileName,
                path: path.posix.join(PLUGINS_LABEL, relativePath),
                fullPath: fullPath,
              });
            }
          }
        }
      } catch (e) {}
    }

    if (fs.existsSync(pluginsPath)) searchInPlugins(pluginsPath);

    if (foundCommands.length > 0) {
      if (foundCommands.length > 1) {
        let text = `🔍 *نتائج البحث عن "${name}":*\n\n`;
        foundCommands.forEach((result, index) => {
          text += `📌 *${index + 1}. ${result.commandName}*\n`;
          text += `   📂 المسار: \`${result.path}\`\n\n`;
        });
        return await reply({ text: text });
      }
      const result = foundCommands[0];
      const content = fs.readFileSync(result.fullPath, "utf-8");
      return await sendRichCode(m, conn, from, result.commandName, content, result.path, reply);
    }

    await reply({ text: `❌ لا يوجد أمر باسم "${name}".\n💡 استخدم \`.باتش\` لعرض جميع الأوامر.` });
  } catch (error) {
    console.error("[ showCommandByName ]", error);
    await reply({ text: `❌ حدث خطأ:\n${error.message}` });
  }
}

async function showAllCommands(m, conn, from, reply) {
  try {
    const commandList = await getCommandList();
    if (commandList.length === 0) return await reply({ text: "❌ لا توجد أوامر محملة." });

    let text = `╭──〔 📋 قائمة الأوامر 〕\n│\n`;
    let total = 0,
      commandCounter = 0;
    const commandsByFolder = {};
    commandList.forEach((cmd) => {
      const folder = cmd.folder || "plugins";
      if (!commandsByFolder[folder]) commandsByFolder[folder] = [];
      commandsByFolder[folder].push(cmd);
    });

    const sortedFolders = Object.keys(commandsByFolder).sort((a, b) => a.localeCompare(b, "ar"));
    for (const folder of sortedFolders) {
      const cmds = commandsByFolder[folder];
      text += `├─ 📂 ${folder}\n`;
      total += cmds.length;
      cmds.sort((a, b) => a.command.localeCompare(b.command, "ar"));
      for (const cmd of cmds) {
        commandCounter++;
        text += `│  ${commandCounter}. ${cmd.command}\n`;
      }
    }
    text += `│\n╰─〔 📊 المجموع: ${total} أمر 〕`;

    if (text.length > 4000) {
      const chunks = [];
      let current = "";
      for (const line of text.split("\n")) {
        if ((current + line + "\n").length > 4000) {
          chunks.push(current);
          current = "";
        }
        current += line + "\n";
      }
      if (current) chunks.push(current);
      for (const chunk of chunks) await reply({ text: chunk });
    } else {
      await reply({ text: text });
    }
  } catch (error) {
    console.error("[ showAllCommands ]", error);
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
        const relativePath = path.relative(baseDir, dir);

        commandList.push({
          number: counter,
          command: fileName,
          realPath: path.posix.join(PLUGINS_LABEL, relativePath, file.name),
          folder: folderName,
          fullPath: path.join(dir, file.name),
        });
      }

      const folders = items.filter((item) => item.isDirectory());
      for (const folder of folders) {
        scanDir(path.join(dir, folder.name), folder.name);
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

    function searchDir(dir) {
      try {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
          const fullPathFile = path.join(dir, file.name);
          if (file.isDirectory()) {
            const r = searchDir(fullPathFile);
            if (r) return r;
          } else if (file.isFile() && file.name.endsWith(".js")) {
            if (file.name === `${commandName}.js`) {
              return fs.readFileSync(fullPathFile, "utf-8");
            }
          }
        }
        return null;
      } catch (err) {
        return null;
      }
    }
    return searchDir(baseDir);
  } catch (error) {
    console.error("[ getCommandCode ]", error);
    return null;
  }
}

async function sendRichCode(m, conn, from, commandName, code, filePath, reply) {
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
    console.error("[ sendRichCode ]", error);
    await reply({ text: `❌ حدث خطأ أثناء عرض الكود:\n${error.message}` });
  }
}
