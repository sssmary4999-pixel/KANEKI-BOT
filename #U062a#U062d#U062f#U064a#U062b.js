import { execSync } from "child_process";
import { loadPlugins } from "../../Corleone/pluginLoader.js";

export default {
  name: ["تحديث"],
  description: "يفرض التحديث من GitHub ويعيد تحميل الإضافات",
  category: "المالك",
  ownerOnly: true,

  async run({ reply, react }) {

    try {
      await react("🔄");

      execSync("git fetch --all");

      const localSha = execSync("git rev-parse HEAD").toString().trim();
      const remoteSha = execSync("git rev-parse origin/main").toString().trim();

      if (localSha === remoteSha) {
        await react("✅");
        return await reply({ text: ( "✅ *كل شيء محدّث، لا توجد تغييرات جديدة.*") });
      }

      // 📋 قائمة الملفات المعدّلة الفعلية قبل تطبيق الاستعادة
      const archivosCambiados = execSync(`git diff --stat ${localSha} ${remoteSha}`).toString().trim();

      // 📝 قائمة الالتزامات الجديدة التي ستُطبَّق
      const commitsNuevos = execSync(`git log ${localSha}..${remoteSha} --oneline`).toString().trim();

      execSync("git reset --hard origin/main");

      await loadPlugins();

      let textoUpdate = ( `✅ *تم التحديث الإجباري بنجاح*\n\n`);
      textoUpdate += ( `📦 *الالتزامات الجديدة:*\n\`\`\`${commitsNuevos || "(لا تفاصيل)"}\`\`\`\n\n`);
      textoUpdate += ( `📋 *الملفات المعدّلة:*\n\`\`\`${archivosCambiados || "(لا تغييرات)"}\`\`\`\n\n`);
      textoUpdate += ( `🔄 _أُعيد تحميل الإضافات في الذاكرة بلا تعارض._`);

      await react("✅");
      await reply({ text: textoUpdate });

    } catch (err) {
      await react("❌");
      await reply({
        text: ( `❌ *خطأ حرج في التحديث:* ${err.message}\n\`\`\`${err.stderr?.toString() || ""}\`\`\``)
      });
    }
  },
};