import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { distributor_name, content } = body;

    const token = '8819290545:AAE2fRCIhKhHTyvtIvAirsKMeXyMFCPKlAA';
    const chatId = '529585421';

    const telegramMessage = `📩 تنبيه جديد من نظام TawasulNet\n\n👤 الموزع: ${distributor_name}\n💬 الرسالة: ${content}`;

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: telegramMessage,
      }),
    });

    const data = await res.json();

    if (!data.ok) {
      throw new Error('فشل إرسال الرسالة إلى تيليجرام');
    }

    return NextResponse.json({ success: true, message: 'تم إرسال الإشعار بنجاح' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
