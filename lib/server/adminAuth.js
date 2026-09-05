import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getEnvError() {
  const missing = [];

  if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missing.length > 0) {
    return `Missing server environment variables: ${missing.join(', ')}`;
  }

  return null;
}

/**
 * حماية Server API للمدير فقط.
 *
 * الاستخدام:
 * const auth = await requireAdmin(request);
 *
 * if (!auth.ok) {
 *   return auth.response;
 * }
 *
 * const { user, adminProfile, adminClient } = auth;
 */
export async function requireAdmin(request) {
  try {
    const envError = getEnvError();

    if (envError) {
      console.error('[ADMIN AUTH]', envError);

      return {
        ok: false,
        response: Response.json(
          {
            success: false,
            error: 'إعدادات الخادم غير مكتملة.',
          },
          {
            status: 500,
            headers: {
              'Cache-Control': 'no-store',
            },
          }
        ),
      };
    }

    const authorization = request.headers.get('authorization');

    if (!authorization) {
      return {
        ok: false,
        response: Response.json(
          {
            success: false,
            error: 'غير مصرح بالوصول.',
          },
          {
            status: 401,
            headers: {
              'Cache-Control': 'no-store',
            },
          }
        ),
      };
    }

    const match = authorization.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      return {
        ok: false,
        response: Response.json(
          {
            success: false,
            error: 'رمز المصادقة غير صالح.',
          },
          {
            status: 401,
            headers: {
              'Cache-Control': 'no-store',
            },
          }
        ),
      };
    }

    const accessToken = match[1].trim();

    if (!accessToken) {
      return {
        ok: false,
        response: Response.json(
          {
            success: false,
            error: 'رمز المصادقة مفقود.',
          },
          {
            status: 401,
            headers: {
              'Cache-Control': 'no-store',
            },
          }
        ),
      };
    }

    /*
     * أولًا:
     * نتحقق من الـ JWT باستخدام Supabase Auth.
     *
     * مهم:
     * لا نثق بالـ profile القادم من المتصفح.
     */
    const authClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(accessToken);

    if (userError || !user) {
      return {
        ok: false,
        response: Response.json(
          {
            success: false,
            error: 'جلسة الدخول غير صالحة أو منتهية.',
          },
          {
            status: 401,
            headers: {
              'Cache-Control': 'no-store',
            },
          }
        ),
      };
    }

    /*
     * ثانيًا:
     * نستخدم Service Role فقط بعد التحقق من هوية المستخدم.
     *
     * Service Role لا يتم إرساله إلى المتصفح.
     */
    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

    const {
      data: adminProfile,
      error: profileError,
    } = await adminClient
      .from('profiles')
      .select('id, full_name, email, role, status')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[ADMIN AUTH] Profile lookup failed:', profileError);

      return {
        ok: false,
        response: Response.json(
          {
            success: false,
            error: 'تعذر التحقق من صلاحيات الحساب.',
          },
          {
            status: 500,
            headers: {
              'Cache-Control': 'no-store',
            },
          }
        ),
      };
    }

    if (!adminProfile) {
      return {
        ok: false,
        response: Response.json(
          {
            success: false,
            error: 'الحساب غير موجود في نظام الإدارة.',
          },
          {
            status: 403,
            headers: {
              'Cache-Control': 'no-store',
            },
          }
        ),
      };
    }

    if (adminProfile.role !== 'admin') {
      return {
        ok: false,
        response: Response.json(
          {
            success: false,
            error: 'ليس لديك صلاحية المدير.',
          },
          {
            status: 403,
            headers: {
              'Cache-Control': 'no-store',
            },
          }
        ),
      };
    }

    if (adminProfile.status !== 'active') {
      return {
        ok: false,
        response: Response.json(
          {
            success: false,
            error: 'حساب المدير غير نشط.',
          },
          {
            status: 403,
            headers: {
              'Cache-Control': 'no-store',
            },
          }
        ),
      };
    }

    return {
      ok: true,
      user,
      adminProfile,
      adminClient,
    };
  } catch (error) {
    console.error('[ADMIN AUTH] Unexpected error:', error);

    return {
      ok: false,
      response: Response.json(
        {
          success: false,
          error: 'حدث خطأ أثناء التحقق من الصلاحيات.',
        },
        {
          status: 500,
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      ),
    };
  }
}
