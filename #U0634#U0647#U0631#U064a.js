import { checkCooldown, setCooldown, addBolsillo, formatTime } from "../../Corleone/economy.js";

export default {
  name: ["شهري"],
  description: "استلم مكافأتك الشهرية",
  category: "الاقتصاد",

  async run({ sender, reply }) {

    const status = checkCooldown(sender, "monthly");
    if (!status.ready) {
      return await reply({ text: ( `⏳ استلمت مكافأتك الشهرية بالفعل. عد بعد *${formatTime(status.remaining)}*.`) });
    }

    const amount = Math.floor(Math.random() * 6000) + 4000;
    addBolsillo(sender, amount);
    setCooldown(sender, "monthly");

    await reply({ text: ( `💰 استلمت مكافأتك الشهرية: *+${amount}* عملة.`) });
  }
};