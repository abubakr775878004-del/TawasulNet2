import { NextResponse } from 'next/server';

import {
  sendTelegramMessage,
} from '../../../lib/telegram';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req) {
  try {
    const secret = process.env.CRON_SECRET?.trim();

    const url = new URL(req.url);
    const key = url.searchParams.get('key')?.trim();

    if (!secret || key !== secret) {
      return NextResponse.json(
        {
          success: false,
          error: 'غير مصرح بالاختبار',
        },
        { status: 401 }
      );
    }

    const message =
      '👑 <b>اختبار نظام السحب الأسبوعي</b> 👑\n' +
      '━━━━━━━━━━━━━━━━━━━━\n\n' +
      '🥇 <b>المركز الأول:</b> سعيد بدون\n' +
      '🏪 <b>الموزع:</b> خالد\n\n' +
      '🥈 <b>المركز الثاني:</b> محمد محمود\n' +
      '🏪 <b>الموزع:</b> خالد\n\n' +
      '🥉 <b>المركز الثالث:</b> ابوبكر محسن\n' +
      '🏪 <b>الموزع:</b> خالد\n\n' +
      '━━━━━━━━━━━━━━━━━━━━\n' +
      '🧪 <b>هذه رسالة اختبار فقط</b>\n' +
      '━━━━━━━━━━━━━━━━━━━━';

    const result = await sendTelegramMessage(message);

    return NextResponse.json({
      success: true,
      message: 'تم إرسال رسالة الاختبار إلى Telegram',
      telegramMessageId: result.messageId,
    });
  } catch (error) {
    console.error('Telegram test error:', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'حدث خطأ أثناء إرسال رسالة الاختبار',
      },
      { status: 500 }
    );
  }
}
