import { NextResponse } from 'next/server';

// إعداد لضمان عدم تخزين الطلبات في الكاش
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { distributor_name, content } = await req.json();

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.error('Missing Telegram Environment Variables');
      return NextResponse.json({ error: 'Telegram credentials missing' }, { status: 500 });
    }

    // تصميم الرسالة لتكون بارزة وتصل في كل مرة
    const message = `✉️ *إشعار جديد من نظام TawasulNet*\n\n` +
                    `👤 *الموزع:* ${distributor_name}\n` +
                    `💬 *الرسالة:* ${content}`;

    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache' // ضمان عدم وجود كاش
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      console.error('Telegram API Error:', data);
      return NextResponse.json({ error: data.description }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Route Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
