import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();
    const { distributor_name, content } = body;

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      return NextResponse.json({ error: 'Telegram credentials missing' }, { status: 500 });
    }

    // تصميم إشعار تفاعلي وبارز يصل مع كل رسالة جديدة
    const message = `🚨 *تنبيه طلب من موزع* 🚨\n\n` +
                    `👤 *اسم الموزع:* ${distributor_name}\n` +
                    `📝 *الطلب / الملاحظة:* ${content}\n\n` +
                    `⚡ *نظام إدارة شبكة تواصل*`;

    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const telegramRes = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    const result = await telegramRes.json();

    if (!result.ok) {
      console.error('Telegram API Error:', result);
      return NextResponse.json({ error: result.description || 'Failed to send telegram message' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
