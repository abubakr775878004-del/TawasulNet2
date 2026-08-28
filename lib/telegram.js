export async function sendWinnersToTelegram(winners) {
  try {
    const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
    const chatId = process.env.NEXT_PUBLIC_TELEGRAM_ADMIN_CHAT_ID;

    if (!botToken || !chatId) {
      console.error('بيانات التليجرام غير مقتطعة من البيئة');
      return false;
    }

    const winner = Array.isArray(winners) ? winners[0] : winners;

    if (!winner || !winner.customer_name) return false;

    const message = 
`👑 *بطـاقـة الفـائز بالـسـحـب الأسبـوعـي* 👑
━━━━━━━━━━━━━━━━━━━━
🎉 *الفائز:* ${winner.customer_name}
🏪 *الموزع:* ${winner.distributor_name || 'غير محدد'}
━━━━━━━━━━━━━━━━━━━━`;

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
