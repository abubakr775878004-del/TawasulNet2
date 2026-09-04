import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    // الاتصال بـ Supabase بصلاحية Service Role
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
    // تنفيذ السحب
    // ============================================================

    const { data, error } =
      await supabase.rpc('draw_weekly_winners');

    if (error) {
      console.error(
        'Weekly draw RPC error:',
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

    console.log(
      'Weekly winner draw result:',
      JSON.stringify(data)
    );

    return NextResponse.json(
      {
        success: true,
        result: data,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error(
      'Weekly draw cron error:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'حدث خطأ أثناء تنفيذ السحب',
      },
      { status: 500 }
    );
  }
}
