import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const MIKROTIK_URL = process.env.MIKROTIK_URL;
const MIKROTIK_USERNAME = process.env.MIKROTIK_USERNAME;
const MIKROTIK_PASSWORD = process.env.MIKROTIK_PASSWORD;

const MAX_BATCH = 1000;
const BATCH_CONCURRENCY = 8;

function jsonError(message, status = 400, extra = {}) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...extra,
    },
    { status }
  );
}

function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Supabase server environment variables are missing.'
    );
  }

  return createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

async function authenticateAdmin(request) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Supabase authentication environment variables are missing.'
    );
  }

  const authorization =
    request.headers.get('authorization') || '';

  if (!authorization.startsWith('Bearer ')) {
    return {
      ok: false,
      response: jsonError('غير مصرح بالدخول.', 401),
    };
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return {
      ok: false,
      response: jsonError('جلسة الدخول غير صالحة.', 401),
    };
  }

  const supabaseAuth = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabaseAuth.auth.getUser(token);

  if (userError || !user) {
    return {
      ok: false,
      response: jsonError('جلسة الدخول غير صالحة.', 401),
    };
  }

  const admin = getSupabaseAdmin();

  const {
    data: profile,
    error: profileError,
  } = await admin
    .from('profiles')
    .select('id, role, status')
    .eq('id', user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.role !== 'admin' ||
    profile.status !== 'active'
  ) {
    return {
      ok: false,
      response: jsonError(
        'هذه العملية متاحة للمدير فقط.',
        403
      ),
    };
  }

  return {
    ok: true,
    user,
    profile,
  };
}

function getMikrotikConfig() {
  if (
    !MIKROTIK_URL ||
    !MIKROTIK_USERNAME ||
    !MIKROTIK_PASSWORD
  ) {
    throw new Error(
      'بيانات اتصال MikroTik غير مكتملة في Environment Variables.'
    );
  }

  const baseUrl = MIKROTIK_URL.replace(/\/+$/, '');

  if (!baseUrl.startsWith('https://')) {
    throw new Error(
      'MIKROTIK_URL يجب أن يبدأ بـ https:// لاستخدام الاتصال الآمن.'
    );
  }

  return {
    baseUrl,
    auth:
      'Basic ' +
      Buffer.from(
        `${MIKROTIK_USERNAME}:${MIKROTIK_PASSWORD}`
      ).toString('base64'),
  };
}

async function mikrotikRequest(
  path,
  options = {}
) {
  const config = getMikrotikConfig();

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 15000);

  try {
    const response = await fetch(
      `${config.baseUrl}/rest/${path.replace(/^\/+/, '')}`,
      {
        ...options,
        headers: {
          Authorization: config.auth,
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
        cache: 'no-store',
        signal: controller.signal,
      }
    );

    const text = await response.text();

    let data = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      const message =
        typeof data === 'object' && data?.message
          ? data.message
          : `MikroTik HTTP ${response.status}`;

      const error = new Error(message);
      error.status = response.status;
      error.data = data;

      throw error;
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function testMikrotik() {
  const data = await mikrotikRequest(
    'system/resource'
  );

  const resource = Array.isArray(data)
    ? data[0]
    : data;

  return {
    version: resource?.version || null,
    board:
      resource?.['board-name'] ||
      resource?.board ||
      null,
    platform: resource?.platform || null,
  };
}

async function getProfiles() {
  const data = await mikrotikRequest(
    'user-manager/profile'
  );

  const profiles = Array.isArray(data)
    ? data
    : [];

  return profiles
    .map((profile) => ({
      id: profile['.id'] || null,
      name: profile.name || '',
      nameForUsers:
        profile['name-for-users'] || '',
      price: profile.price || '0',
      validity:
        profile.validity || 'unlimited',
      startsWhen:
        profile['starts-when'] || 'assigned',
      comment: profile.comment || '',
    }))
    .filter((profile) => profile.name);
}

function validateCodeFormat(code) {
  return (
    typeof code === 'string' &&
    /^[0-9]+$/.test(code)
  );
}

function generateCode(prefix, totalLength) {
  const remaining =
    totalLength - prefix.length;

  let suffix = '';

  for (let i = 0; i < remaining; i += 1) {
    suffix += crypto.randomInt(0, 10).toString();
  }

  return `${prefix}${suffix}`;
}

async function generateUniqueCodes(
  prefix,
  totalLength,
  quantity,
  supabase
) {
  const codes = new Set();

  const maximumPossible =
    10 ** (totalLength - prefix.length);

  if (quantity > maximumPossible) {
    throw new Error(
      'عدد الكروت المطلوب أكبر من عدد الأكواد الممكنة لهذا الطول والبداية.'
    );
  }

  const maxAttempts =
    Math.max(quantity * 50, 5000);

  let attempts = 0;

  while (
    codes.size < quantity &&
    attempts < maxAttempts
  ) {
    attempts += 1;

    const code = generateCode(
      prefix,
      totalLength
    );

    codes.add(code);
  }

  if (codes.size !== quantity) {
    throw new Error(
      'تعذر توليد أكواد فريدة بالعدد المطلوب.'
    );
  }

  const generated = [...codes];

  const { data: existingCards, error } =
    await supabase
      .from('cards')
      .select('code')
      .in('code', generated);

  if (error) {
    throw new Error(
      `تعذر فحص الأكواد الموجودة: ${error.message}`
    );
  }

  const existing = new Set(
    (existingCards || []).map(
      (card) => card.code
    )
  );

  if (existing.size > 0) {
    return generateUniqueCodes(
      prefix,
      totalLength,
      quantity,
      supabase
    );
  }

  return generated;
}

async function createMikrotikUser(
  code,
  profileName
) {
  let createdUser = null;

  try {
    createdUser = await mikrotikRequest(
      'user-manager/user',
      {
        method: 'PUT',
        body: JSON.stringify({
          name: code,
          password: code,
          'shared-users': '1',
        }),
      }
    );

    await mikrotikRequest(
      'user-manager/user-profile',
      {
        method: 'PUT',
        body: JSON.stringify({
          user: code,
          profile: profileName,
        }),
      }
    );

    return {
      success: true,
      code,
      user: createdUser,
    };
  } catch (error) {
    /*
     * إذا تم إنشاء المستخدم ولكن فشل ربط الـ Profile،
     * نحاول تنظيف المستخدم حتى لا يبقى كرت ناقص داخل MikroTik.
     */
    if (createdUser?.['.id']) {
      try {
        await mikrotikRequest(
          `user-manager/user/${encodeURIComponent(
            createdUser['.id']
          )}`,
          {
            method: 'DELETE',
          }
        );
      } catch {
        // لا نخفي الخطأ الأصلي.
      }
    }

    return {
      success: false,
      code,
      error:
        error?.message ||
        'فشل إنشاء المستخدم في MikroTik.',
    };
  }
}

async function runWithConcurrency(
  items,
  concurrency,
  worker
) {
  const results = new Array(items.length);

  let nextIndex = 0;

  async function runner() {
    while (true) {
      const index = nextIndex;

      if (index >= items.length) {
        return;
      }

      nextIndex += 1;

      try {
        results[index] =
          await worker(items[index], index);
      } catch (error) {
        results[index] = {
          success: false,
          code: items[index],
          error:
            error?.message ||
            'خطأ غير معروف.',
        };
      }
    }
  }

  const workers = Array.from(
    {
      length: Math.min(
        concurrency,
        items.length
      ),
    },
    () => runner()
  );

  await Promise.all(workers);

  return results;
}

async function saveSuccessfulCards(
  supabase,
  packageId,
  successfulCodes
) {
  if (!successfulCodes.length) {
    return {
      inserted: [],
      failed: [],
    };
  }

  const rows = successfulCodes.map(
    (code) => ({
      code,
      package_id: packageId,
      status: 'available',
    })
  );

  const {
    data,
    error,
  } = await supabase
    .from('cards')
    .insert(rows)
    .select(
      'id, code, package_id, status, created_at'
    );

  if (!error) {
    return {
      inserted: data || [],
      failed: [],
    };
  }

  /*
   * في حالة وجود تعارض، نحاول إدخال كل كرت بشكل منفصل
   * حتى لا نخسر الدفعة كاملة.
   */
  const inserted = [];
  const failed = [];

  for (const row of rows) {
    const {
      data: insertedRow,
      error: insertError,
    } = await supabase
      .from('cards')
      .insert(row)
      .select(
        'id, code, package_id, status, created_at'
      )
      .maybeSingle();

    if (insertError) {
      failed.push({
        code: row.code,
        error: insertError.message,
      });
    } else if (insertedRow) {
      inserted.push(insertedRow);
    }
  }

  return {
    inserted,
    failed,
  };
}

async function deleteMikrotikUser(
  code
) {
  try {
    const users = await mikrotikRequest(
      'user-manager/user',
      {
        method: 'POST',
        body: JSON.stringify({
          '.proplist': [
            '.id',
            'name',
          ],
          '.query': [
            `name=${code}`,
          ],
        }),
      }
    );

    const user = Array.isArray(users)
      ? users[0]
      : null;

    if (!user?.['.id']) {
      return;
    }

    await mikrotikRequest(
      `user-manager/user/${encodeURIComponent(
        user['.id']
      )}`,
      {
        method: 'DELETE',
      }
    );
  } catch {
    // سيتم الإبلاغ عن الكرت كحالة تحتاج reconciliation.
  }
}

export async function GET(request) {
  const auth = await authenticateAdmin(
    request
  );

  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } =
    new URL(request.url);

  const action =
    searchParams.get('action') || 'profiles';

  try {
    if (action === 'test') {
      const result =
        await testMikrotik();

      return NextResponse.json({
        success: true,
        connected: true,
        ...result,
      });
    }

    if (action === 'profiles') {
      const profiles =
        await getProfiles();

      const supabase =
        getSupabaseAdmin();

      const {
        data: mappings,
        error: mappingError,
      } = await supabase
        .from(
          'mikrotik_package_mappings'
        )
        .select(
          'package_id, mikrotik_profile_name'
        );

      if (mappingError) {
        return jsonError(
          `تعذر تحميل الربط: ${mappingError.message}`,
          500
        );
      }

      return NextResponse.json({
        success: true,
        profiles,
        mappings: mappings || [],
      });
    }

    return jsonError(
      'الأمر المطلوب غير معروف.',
      400
    );
  } catch (error) {
    return jsonError(
      error?.message ||
        'تعذر الاتصال بـ MikroTik.',
      500
    );
  }
}

export async function POST(request) {
  const auth = await authenticateAdmin(
    request
  );

  if (!auth.ok) {
    return auth.response;
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return jsonError(
      'بيانات الطلب غير صالحة.',
      400
    );
  }

  const action = body?.action;

  try {
    const supabase =
      getSupabaseAdmin();

    /*
     * حفظ الربط اليدوي:
     * package -> MikroTik profile
     */
    if (action === 'save-mapping') {
      const packageId =
        String(body.packageId || '').trim();

      const profileName =
        String(
          body.profileName || ''
        ).trim();

      if (!packageId || !profileName) {
        return jsonError(
          'يجب اختيار الباقة والـ Profile.',
          400
        );
      }

      const {
        data: packageRow,
        error: packageError,
      } = await supabase
        .from('packages')
        .select('id')
        .eq('id', packageId)
        .maybeSingle();

      if (
        packageError ||
        !packageRow
      ) {
        return jsonError(
          'الباقة غير موجودة.',
          404
        );
      }

      /*
       * نتأكد أن الـ Profile موجود فعليًا
       * داخل User Manager قبل حفظ الربط.
       */
      const profiles =
        await getProfiles();

      const profileExists =
        profiles.some(
          (profile) =>
            profile.name === profileName
        );

      if (!profileExists) {
        return jsonError(
          'الـ Profile المحدد غير موجود حاليًا في User Manager.',
          400
        );
      }

      const {
        data,
        error,
      } = await supabase
        .from(
          'mikrotik_package_mappings'
        )
        .upsert(
          {
            package_id: packageId,
            mikrotik_profile_name:
              profileName,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'package_id',
          }
        )
        .select()
        .single();

      if (error) {
        return jsonError(
          `تعذر حفظ الربط: ${error.message}`,
          500
        );
      }

      return NextResponse.json({
        success: true,
        mapping: data,
      });
    }

    /*
     * إنشاء كروت حقيقية.
     */
    if (action === 'create-cards') {
      const packageId =
        String(body.packageId || '').trim();

      const quantity =
        Number(body.quantity);

      const prefix =
        String(body.prefix || '').trim();

      const codeLength =
        Number(body.codeLength);

      if (!packageId) {
        return jsonError(
          'يجب اختيار الباقة.',
          400
        );
      }

      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > MAX_BATCH
      ) {
        return jsonError(
          `الكمية يجب أن تكون بين 1 و${MAX_BATCH}.`,
          400
        );
      }

      if (
        !prefix ||
        !validateCodeFormat(prefix)
      ) {
        return jsonError(
          'البداية يجب أن تحتوي على أرقام فقط.',
          400
        );
      }

      if (
        !Number.isInteger(codeLength) ||
        codeLength < 4 ||
        codeLength > 32
      ) {
        return jsonError(
          'طول الكرت يجب أن يكون بين 4 و32.',
          400
        );
      }

      if (prefix.length >= codeLength) {
        return jsonError(
          'طول البداية يجب أن يكون أقل من طول الكرت.',
          400
        );
      }

      const {
        data: packageRow,
        error: packageError,
      } = await supabase
        .from('packages')
        .select(
          'id, name, price'
        )
        .eq('id', packageId)
        .maybeSingle();

      if (
        packageError ||
        !packageRow
      ) {
        return jsonError(
          'الباقة غير موجودة.',
          404
        );
      }

      const {
        data: mapping,
        error: mappingError,
      } = await supabase
        .from(
          'mikrotik_package_mappings'
        )
        .select(
          'package_id, mikrotik_profile_name'
        )
        .eq('package_id', packageId)
        .maybeSingle();

      if (
        mappingError ||
        !mapping
      ) {
        return jsonError(
          'لم يتم ربط هذه الباقة بأي Profile في User Manager.',
          400
        );
      }

      /*
       * نتأكد مرة أخرى أن الـ Profile ما زال موجودًا.
       */
      const profiles =
        await getProfiles();

      const profileExists =
        profiles.some(
          (profile) =>
            profile.name ===
            mapping.mikrotik_profile_name
        );

      if (!profileExists) {
        return jsonError(
          'الـ Profile المرتبط بهذه الباقة لم يعد موجودًا في User Manager.',
          400
        );
      }

      /*
       * توليد الأكواد من السيرفر وليس من المتصفح.
       */
      const codes =
        await generateUniqueCodes(
          prefix,
          codeLength,
          quantity,
          supabase
        );

      /*
       * إنشاء المستخدمين على MikroTik
       * بعدد اتصالات متوازٍ محدود.
       */
      const mikrotikResults =
        await runWithConcurrency(
          codes,
          BATCH_CONCURRENCY,
          (code) =>
            createMikrotikUser(
              code,
              mapping.mikrotik_profile_name
            )
        );

      const successfulCodes =
        mikrotikResults
          .filter(
            (result) => result.success
          )
          .map(
            (result) => result.code
          );

      const failedMikrotik =
        mikrotikResults.filter(
          (result) => !result.success
        );

      /*
       * إدخال الناجحين فقط إلى cards.
       */
      const saved =
        await saveSuccessfulCards(
          supabase,
          packageId,
          successfulCodes
        );

      /*
       * إذا فشل إدخال كرت في Supabase
       * بعد نجاحه في MikroTik، نحاول إزالة
       * المستخدم من MikroTik لمنع عدم التطابق.
       */
      if (saved.failed.length) {
        for (const failed of saved.failed) {
          await deleteMikrotikUser(
            failed.code
          );
        }
      }

      return NextResponse.json({
        success: true,

        package: {
          id: packageRow.id,
          name: packageRow.name,
          price: packageRow.price,
        },

        mikrotikProfile:
          mapping.mikrotik_profile_name,

        requested: quantity,

        createdInMikrotik:
          successfulCodes.length,

        savedInSupabase:
          saved.inserted.length,

        failed:
          failedMikrotik.length +
          saved.failed.length,

        results: {
          successful: saved.inserted.map(
            (card) => card.code
          ),

          failed: [
            ...failedMikrotik,
            ...saved.failed,
          ],
        },
      });
    }

    return jsonError(
      'الأمر المطلوب غير معروف.',
      400
    );
  } catch (error) {
    return jsonError(
      error?.message ||
        'حدث خطأ أثناء تنفيذ العملية.',
      500
    );
  }
}
