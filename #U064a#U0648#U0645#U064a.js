import { db } from "../../database/db.js";
import { checkCooldown, setCooldown, addBolsillo, formatTime } from "../../Corleone/economy.js";

export default {
  name: ["يومي"],
  description: "استلم مكافأتك اليومية",
  category: "الاقتصاد",

  async run({ sender, reply }) {

    const status = checkCooldown(sender, "daily");
    if (!status.ready) {
      return await reply({ text: ( `⏳ استلمت يوميتك بالفعل. عد بعد *${formatTime(status.remaining)}*.`) });
    }

    const amount = Math.floor(Math.random() * 300) + 200;
    addBolsillo(sender, amount);
    setCooldown(sender, "daily");

    await reply({ text: ( `💰 استلمت يوميتك: *+${amount}* عملة.`) });
  }
};