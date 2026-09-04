import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import {
  buildWeeklyWinnerMessage,
  sendTelegramMessage,
} from '@/lib/telegram';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    console.error('CRON_SECRET غير موجود');
    return false;
  }

  const authorization =
    req.headers.get('authorization') || '';

  return authorization === `Bearer ${secret}`;
}

export async function GET(req) {
  try {
    // ============================================================
    // حماية Cron
    // ============================================================

    if (!isAuthorized(req)) {
      return NextResponse.json(
        {
          success: false,
          error: 'غير مصرح',
        },
        { status: 401 }
      );
    }

    // ============================================================
    // Supabase Service Role
    // ============================================================

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            'متغيرات Supabase الخاصة بالخادم غير مكتملة',
        },
        { status: 500 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // ============================================================
    // تحديد الجمعة الحالية حسب توقيت اليمن
    // ============================================================

    const localNow = new Date(
      new Date().toLocaleString(
        'en-US',
        {
          timeZone: 'Asia/Aden',
        }
      )
    );

    const day = localNow.getDay();

    if (day !== 5) {
      return NextResponse.json(
        {
          success: false,
          message:
            'إشعار الفائزين يعمل يوم الجمعة فقط',
        },
        { status: 400 }
      );
    }

    const year = localNow.getFullYear();
    const month =
      String(localNow.getMonth() + 1).padStart(2, '0');
    const date =
      String(localNow.getDate()).padStart(2, '0');

    const weekKey =
      `${year}-${month}-${date}`;

    // ============================================================
    // جلب نفس الفائزين المحفوظين
    // ============================================================

    const { data: winners, error } =
      await supabase
        .from('weekly_winners')
        .select(`
          id,
          week_key,
          rank,
          card_id,
          customer_name,
          distributor_id,
          distributor_name,
          draw_at,
          expires_at,
          telegram_sent_at
        `)
        .eq('week_key', weekKey)
        .order('rank', {
          ascending: true,
        });

    if (error) {
      console.error(
        'Weekly winners fetch error:',
        error
      );

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    // ============================================================
    // يجب أن يكون لدينا 3 فائزين بالضبط
    // ============================================================

    if (!winners || winners.length !== 3) {
      return NextResponse.json(
        {
          success: false,
          error:
            'لم يتم العثور على ثلاثة فائزين محفوظين لهذا الأسبوع',
          week_key: weekKey,
          winner_count: winners?.length || 0,
        },
        { status: 409 }
      );
    }

    // ============================================================
    // منع إرسال Telegram مرتين
    // ============================================================

    const alreadySent =
      winners.every(
        (winner) =>
          winner.telegram_sent_at !== null
      );

    if (alreadySent) {
      return NextResponse.json(
        {
          success: true,
          already_sent: true,
          message:
            'تم إرسال فائزين هذا الأسبوع مسبقاً',
          week_key: weekKey,
        },
        { status: 200 }
      );
    }

    // ============================================================
    // إنشاء الرسالة من نفس الفائزين المحفوظين
    // ============================================================

    const message =
      buildWeeklyWinnerMessage(winners);

    // ============================================================
    // الإرسال إلى نفس Telegram Bot + نفس Chat
    // ============================================================

    const telegramResult =
      await sendTelegramMessage(message);

    // ============================================================
    // تسجيل وقت الإرسال
    // ============================================================

    const sentAt = new Date().toISOString();

    const { error: updateError } =
      await supabase
        .from('weekly_winners')
        .update({
          telegram_sent_at: sentAt,
        })
        .eq('week_key', weekKey);

    if (updateError) {
      console.error(
        'Telegram sent but database update failed:',
        updateError
      );

      return NextResponse.json(
        {
          success: true,
          telegram_sent: true,
          database_updated: false,
          warning:
            'تم إرسال الرسالة ولكن لم يتم تسجيل وقت الإرسال في قاعدة البيانات',
          telegramMessageId:
            telegramResult.messageId,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        telegram_sent: true,
        database_updated: true,
        week_key: weekKey,
        winners,
        telegramMessageId:
          telegramResult.messageId,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error(
      'Weekly winner notification error:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'حدث خطأ أثناء إرسال الفائزين',
      },
      { status: 500 }
    );
  }
}
