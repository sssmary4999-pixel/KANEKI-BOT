import { checkCooldown, setCooldown, addBolsillo, formatTime } from "../../Corleone/economy.js";

export default {
  name: ["اسبوعي"],
  description: "استلم مكافأتك الأسبوعية",
  category: "الاقتصاد",

  async run({ sender, reply }) {

    const status = checkCooldown(sender, "weekly");
    if (!status.ready) {
      return await reply({ text: ( `⏳ استلمت مكافأتك الأسبوعية بالفعل. عد بعد *${formatTime(status.remaining)}*.`) });
    }

    const amount = Math.floor(Math.random() * 1500) + 1000;
    addBolsillo(sender, amount);
    setCooldown(sender, "weekly");

    await reply({ text: ( `💰 استلمت مكافأتك الأسبوعية: *+${amount}* عملة.`) });
  }
};