export async function sendWinnersToTelegram(winners) {
  try {
    const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
    const chatId = process.env.NEXT_PUBLIC_TELEGRAM_ADMIN_CHAT_ID;

    if (!botToken || !chatId) {
      console.error('بيانات تلجرام غير مكتملة من البيئة');
      return false;
    }

    // التأكد من أن الإدخال مصفوفة أو تحويله إليها
    const winnersArray = Array.isArray(winners) ? winners : [winners];
    if (winnersArray.length === 0 || !winnersArray[0]?.customer_name) return false;

    // صياغة رسالة تدعم الفائزين الثلاثة
    let message = '👑 *بطـاقـة الفـائزين بالـسـحـب الأسبـوعـي* 👑\n';
    message += '━━━━━━━━━━━━━━━━━━━━\n\n';

    const badges = ['🥇 *المركز الأول:*', '🥈 *المركز الثاني:*', '🥉 *المركز الثالث:*'];

    winnersArray.slice(0, 3).forEach((winner, index) => {
      message += `${badges[index] || '🏆'} ${winner.customer_name}\n`;
      message += `🏪 *الموزع:* ${winner.distributor_name || 'غير محدد'}\n\n`;
    });

    message += '━━━━━━━━━━━━━━━━━━━━\n';
    message += '✨ _تم السحب والاعتماد بنجاح عبر منصة تواصل_';

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    return res.ok;
  } catch (err) {
    console.error('Telegram Send Error:', err);
    return false;
  }
}
