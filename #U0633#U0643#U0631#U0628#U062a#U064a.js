import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';


const execAsync = promisify(exec);


export default {
  name: ["سكربتي"],
  description: "إنشاء نسخة احتياطية من ملفات البوت",
  category: "المطور",
  ownerOnly: true,


  async run(ctx) {
    const { sock, from, msg, reply, react, cmdName } = ctx;
    const usedName = String(cmdName || '').trim();
    const isArabic = /[\u0600-\u06FF]/.test(usedName) || ['سكربتي', 'نسخة'].includes(usedName);


    const t = {
      working: isArabic ? '🕒 جاري إنشاء النسخة الاحتياطية...' : '🕒 Creating backup...',
      done: isArabic ? '✅ تم إنشاء النسخة الاحتياطية' : '✅ Backup created',
      failed: isArabic
        ? (e) => `❌ *| فشل في إنشاء النسخة الاحتياطية!* 💀\n\n*السبب:* ${e}\n\n*حاول مجددًا...* 🕶️`
        : (e) => `❌ Backup failed: ${e}`,
      noFiles: isArabic ? '❌ لم يتم العثور على ملفات للضغط' : '❌ No files found to compress',
      zipMissing: isArabic ? '❌ أداة zip غير مثبتة. ثبّتها بـ: pkg install zip' : '❌ zip not installed'
    };


    // ✅ تفاعل مبدئي
    const doReact = async (emoji) => {
      try {
        if (typeof react === 'function') await react(emoji);
        else await sock.sendMessage(from, { react: { text: emoji, key: msg.key } });
      } catch {}
    };


    try {
      await doReact('🕒');
      await reply({ text: t.working });


      // ===== المجلد المؤقت =====
      const tempDir = path.join(process.cwd(), 'tmp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });


      // 🧹 تنظيف الملفات القديمة
      try {
        for (const f of fs.readdirSync(tempDir)) {
          try { fs.unlinkSync(path.join(tempDir, f)); } catch {}
        }
      } catch {}


      const backupName = 'VITO V3';
      const backupPath = path.join(tempDir, `${backupName}.zip`);


      // ===== الملفات المستثناة =====
      const excludedItems = [
        'node_modules',
        'auth',
        'sessions',
        'Sessions',
        'tmp',
        'database.json',
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        'npm-debug.log',
        '.git',
        '.npm',
        '.env'
      ];


      const excludeArgs = excludedItems
        .map(item => `-x "${item}/*" "${item}"`)
        .join(' ');


      // ===== إنشاء النسخة =====
      try {
        await execAsync(
          `zip -r "${backupPath}" . ${excludeArgs} -q`,
          { maxBuffer: 1024 * 1024 * 50, cwd: process.cwd() }
        );
      } catch (zipError) {
        // خطة بديلة: ضغط فقط ما هو مسموح
        const includeItems = fs.readdirSync('.').filter(item => {
          return (
            !excludedItems.includes(item) &&
            !item.startsWith('.') &&
            item !== 'node_modules'
          );
        });


        if (includeItems.length === 0) {
          await doReact('❌');
          await reply({ text: t.noFiles });
          return;
        }


        await execAsync(
          `zip -r "${backupPath}" ${includeItems.join(' ')} -q`,
          { maxBuffer: 1024 * 1024 * 50, cwd: process.cwd() }
        );
      }


      if (!fs.existsSync(backupPath)) {
        throw new Error('فشل في إنشاء ملف الضغط');
      }


      // ===== إرسال النسخة =====
      await sock.sendMessage(
        from,
        {
          document: fs.readFileSync(backupPath),
          fileName: `${backupName}.zip`,
          mimetype: 'application/zip'
        },
        { quoted: msg }
      );


      // 🧹 حذف الملف المؤقت
      try { fs.unlinkSync(backupPath); } catch {}


      await doReact('✅');


    } catch (error) {
      await doReact('❌');
      try { await reply({ text: t.failed(error.message) }); } catch {}
      console.error('Backup Error:', error);
    }
  }
};