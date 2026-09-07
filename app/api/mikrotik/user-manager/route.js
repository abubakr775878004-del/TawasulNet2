import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

// Environment Variables fallback
const MIKROTIK_URL = process.env.MIKROTIK_URL;
const MIKROTIK_USERNAME = process.env.MIKROTIK_USERNAME;
const MIKROTIK_PASSWORD = process.env.MIKROTIK_PASSWORD;

// مفتاح تشفير كلمة مرور MikroTik المخزنة في قاعدة البيانات.
// يجب أن يكون 32 bytes = 64 حرف Hex.
const MIKROTIK_SETTINGS_ENCRYPTION_KEY =
  process.env.MIKROTIK_SETTINGS_ENCRYPTION_KEY;

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

/* =========================================================
   MikroTik Settings Encryption
   ========================================================= */

function getEncryptionKey() {
  if (!MIKROTIK_SETTINGS_ENCRYPTION_KEY) {
    throw new Error(
      'MIKROTIK_SETTINGS_ENCRYPTION_KEY غير موجود في Environment Variables.'
    );
  }

  const value =
    MIKROTIK_SETTINGS_ENCRYPTION_KEY.trim();

  // 64 hex characters = 32 bytes
  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, 'hex');
  }

  // دعم Base64 أيضًا إذا كانت القيمة 32 bytes.
  try {
    const decoded = Buffer.from(value, 'base64');

    if (decoded.length === 32) {
      return decoded;
    }
  } catch {
    // سيتم إظهار الخطأ أدناه.
  }

  throw new Error(
    'MIKROTIK_SETTINGS_ENCRYPTION_KEY يجب أن يكون 64 حرف Hex أو Base64 بطول 32 bytes.'
  );
}

function encryptPassword(password) {
  const key = getEncryptionKey();

  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    key,
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(password, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

function decryptPassword(encryptedValue) {
  if (
    typeof encryptedValue !== 'string' ||
    !encryptedValue
  ) {
    throw new Error(
      'كلمة مرور MikroTik المخزنة غير صالحة.'
    );
  }

  const parts = encryptedValue.split(':');

  if (
    parts.length !== 4 ||
    parts[0] !== 'v1'
  ) {
    throw new Error(
      'صيغة كلمة مرور MikroTik المخزنة غير صالحة.'
    );
  }

  const [, ivHex, authTagHex, encryptedHex] =
    parts;

  const key = getEncryptionKey();

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(
    authTagHex,
    'hex'
  );
  const encrypted = Buffer.from(
    encryptedHex,
    'hex'
  );

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    iv
  );

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/* =========================================================
   MikroTik Settings
   ========================================================= */

function normalizeMikrotikUrl(value) {
  const url =
    String(value || '').trim();

  if (!url) {
    throw new Error(
      'يجب إدخال عنوان MikroTik.'
    );
  }

  if (!url.startsWith('https://')) {
    throw new Error(
      'عنوان MikroTik يجب أن يبدأ بـ https:// لاستخدام الاتصال الآمن.'
    );
  }

  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      'عنوان MikroTik غير صالح.'
    );
  }

  if (
    parsed.protocol !== 'https:' ||
    !parsed.hostname
  ) {
    throw new Error(
      'عنوان MikroTik يجب أن يكون HTTPS صالحًا.'
    );
  }

  if (
    parsed.username ||
    parsed.password
  ) {
    throw new Error(
      'لا تضع اسم المستخدم أو كلمة المرور داخل رابط MikroTik.'
    );
  }

  return url.replace(/\/+$/, '');
}

function validateMikrotikUsername(value) {
  const username =
    String(value || '').trim();

  if (!username) {
    throw new Error(
      'يجب إدخال اسم مستخدم MikroTik.'
    );
  }

  if (username.length > 255) {
    throw new Error(
      'اسم مستخدم MikroTik طويل جدًا.'
    );
  }

  return username;
}

async function getStoredMikrotikSettings() {
  const supabase = getSupabaseAdmin();

  const {
    data,
    error,
  } = await supabase
    .from('mikrotik_settings')
    .select(
      'id, router_url, username, password_encrypted, created_at, updated_at'
    )
    .eq('id', true)
    .maybeSingle();

  if (error) {
    // إذا كان الجدول غير موجود أو حدث خطأ في الوصول،
    // نرجع الخطأ بوضوح ولا نخلط الإعدادات.
    throw new Error(
      `تعذر قراءة إعدادات MikroTik: ${error.message}`
    );
  }

  return data || null;
}

async function resolveMikrotikConfig() {
  const stored =
    await getStoredMikrotikSettings();

  /*
   * الأولوية للإعدادات المخزنة في قاعدة البيانات.
   */
  if (stored) {
    if (
      !stored.router_url ||
      !stored.username ||
      !stored.password_encrypted
    ) {
      throw new Error(
        'إعدادات MikroTik المخزنة في قاعدة البيانات غير مكتملة.'
      );
    }

    const baseUrl =
      normalizeMikrotikUrl(
        stored.router_url
      );

    const username =
      validateMikrotikUsername(
        stored.username
      );

    const password =
      decryptPassword(
        stored.password_encrypted
      );

    if (!password) {
      throw new Error(
        'كلمة مرور MikroTik المخزنة فارغة.'
      );
    }

    return {
      baseUrl,
      username,
      password,
      source: 'database',
      auth:
        'Basic ' +
        Buffer.from(
          `${username}:${password}`
        ).toString('base64'),
    };
  }

  /*
   * إذا لم توجد إعدادات في DB،
   * نحافظ على دعم Environment Variables القديم.
   */
  if (
    !MIKROTIK_URL ||
    !MIKROTIK_USERNAME ||
    !MIKROTIK_PASSWORD
  ) {
    throw new Error(
      'بيانات اتصال MikroTik غير مكتملة. أدخل إعدادات MikroTik من صفحة الباقات أو قم بضبط Environment Variables.'
    );
  }

  const baseUrl =
    normalizeMikrotikUrl(
      MIKROTIK_URL
    );

  const username =
    validateMikrotikUsername(
      MIKROTIK_USERNAME
    );

  return {
    baseUrl,
    username,
    password: MIKROTIK_PASSWORD,
    source: 'environment',
    auth:
      'Basic ' +
      Buffer.from(
        `${username}:${MIKROTIK_PASSWORD}`
      ).toString('base64'),
  };
}

async function getMikrotikSettingsForClient() {
  const stored =
    await getStoredMikrotikSettings();

  if (stored) {
    return {
      configured: Boolean(
        stored.router_url &&
        stored.username &&
        stored.password_encrypted
      ),
      routerUrl:
        stored.router_url || '',
      username:
        stored.username || '',
      hasPassword:
        Boolean(
          stored.password_encrypted
        ),
      source: 'database',
      updatedAt:
        stored.updated_at || null,
    };
  }

  const environmentConfigured =
    Boolean(
      MIKROTIK_URL &&
      MIKROTIK_USERNAME &&
      MIKROTIK_PASSWORD
    );

  return {
    configured:
      environmentConfigured,
    routerUrl:
      MIKROTIK_URL || '',
    username:
      MIKROTIK_USERNAME || '',
    hasPassword:
      Boolean(MIKROTIK_PASSWORD),
    source:
      environmentConfigured
        ? 'environment'
        : null,
    updatedAt: null,
  };
}

async function saveMikrotikSettings(body) {
  const routerUrl =
    normalizeMikrotikUrl(
      body?.routerUrl
    );

  const username =
    validateMikrotikUsername(
      body?.username
    );

  const password =
    typeof body?.password === 'string'
      ? body.password
      : '';

  const supabase =
    getSupabaseAdmin();

  const {
    data: existing,
    error: existingError,
  } =
    await supabase
      .from('mikrotik_settings')
      .select(
        'id, password_encrypted'
      )
      .eq('id', true)
      .maybeSingle();

  if (existingError) {
    throw new Error(
      `تعذر قراءة إعدادات MikroTik الحالية: ${existingError.message}`
    );
  }

  let passwordEncrypted =
    existing?.password_encrypted ||
    null;

  /*
   * إذا أرسل المستخدم كلمة مرور جديدة:
   * نقوم بتشفيرها.
   *
   * إذا كانت فارغة أثناء التعديل:
   * نحافظ على كلمة المرور القديمة.
   */
  if (password.trim()) {
    passwordEncrypted =
      encryptPassword(password);
  }

  if (!passwordEncrypted) {
    throw new Error(
      'يجب إدخال كلمة مرور MikroTik.'
    );
  }

  const now =
    new Date().toISOString();

  const {
    data,
    error,
  } = await supabase
    .from('mikrotik_settings')
    .upsert(
      {
        id: true,
        router_url: routerUrl,
        username,
        password_encrypted:
          passwordEncrypted,
        updated_at: now,
        ...(existing
          ? {}
          : {
              created_at: now,
            }),
      },
      {
        onConflict: 'id',
      }
    )
    .select(
      'id, router_url, username, created_at, updated_at'
    )
    .single();

  if (error) {
    throw new Error(
      `تعذر حفظ إعدادات MikroTik: ${error.message}`
    );
  }

  return {
    configured: true,
    routerUrl:
      data.router_url,
    username:
      data.username,
    hasPassword: true,
    source: 'database',
    updatedAt:
      data.updated_at || null,
  };
}

/* =========================================================
   MikroTik Requests
   ========================================================= */

async function mikrotikRequest(
  path,
  options = {},
  providedConfig = null
) {
  const config =
    providedConfig ||
    (await resolveMikrotikConfig());

  const controller =
    new AbortController();

  const timeout =
    setTimeout(() => {
      controller.abort();
    }, 15000);

  try {
    const response =
      await fetch(
        `${config.baseUrl}/rest/${path.replace(
          /^\/+/,
          ''
        )}`,
        {
          ...options,
          headers: {
            Authorization:
              config.auth,
            'Content-Type':
              'application/json',
            ...(options.headers || {}),
          },
          cache: 'no-store',
          signal:
            controller.signal,
        }
      );

    const text =
      await response.text();

    let data = null;

    if (text) {
      try {
        data =
          JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      const message =
        typeof data === 'object' &&
        data?.message
          ? data.message
          : `MikroTik HTTP ${response.status}`;

      const error =
        new Error(message);

      error.status =
        response.status;

      error.data = data;

      throw error;
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function testMikrotik(
  config = null
) {
  const data =
    await mikrotikRequest(
      'system/resource',
      {},
      config
    );

  const resource =
    Array.isArray(data)
      ? data[0]
      : data;

  return {
    version:
      resource?.version ||
      null,
    board:
      resource?.['board-name'] ||
      resource?.board ||
      null,
    platform:
      resource?.platform ||
      null,
  };
}

async function getProfiles(
  config = null
) {
  const data =
    await mikrotikRequest(
      'user-manager/profile',
      {},
      config
    );

  const profiles =
    Array.isArray(data)
      ? data
      : [];

  return profiles
    .map((profile) => ({
      id:
        profile['.id'] ||
        null,

      name:
        profile.name ||
        '',

      nameForUsers:
        profile['name-for-users'] ||
        '',

      price:
        profile.price ||
        '0',

      validity:
        profile.validity ||
        'unlimited',

      startsWhen:
        profile['starts-when'] ||
        'assigned',

      comment:
        profile.comment ||
        '',
    }))
    .filter(
      (profile) =>
        profile.name
    );
}

/* =========================================================
   Card Code Generation
   ========================================================= */

function validateCodeFormat(code) {
  return (
    typeof code === 'string' &&
    /^[0-9]+$/.test(code)
  );
}

function generateCode(
  prefix,
  totalLength
) {
  const remaining =
    totalLength -
    prefix.length;

  let suffix = '';

  for (
    let i = 0;
    i < remaining;
    i += 1
  ) {
    suffix += crypto
      .randomInt(0, 10)
      .toString();
  }

  return `${prefix}${suffix}`;
}

async function generateUniqueCodes(
  prefix,
  totalLength,
  quantity,
  supabase
) {
  const codes =
    new Set();

  const maximumPossible =
    10 **
    (totalLength -
      prefix.length);

  if (
    quantity >
    maximumPossible
  ) {
    throw new Error(
      'عدد الكروت المطلوب أكبر من عدد الأكواد الممكنة لهذا الطول والبداية.'
    );
  }

  const maxAttempts =
    Math.max(
      quantity * 50,
      5000
    );

  let attempts = 0;

  while (
    codes.size <
      quantity &&
    attempts <
      maxAttempts
  ) {
    attempts += 1;

    const code =
      generateCode(
        prefix,
        totalLength
      );

    codes.add(code);
  }

  if (
    codes.size !==
    quantity
  ) {
    throw new Error(
      'تعذر توليد أكواد فريدة بالعدد المطلوب.'
    );
  }

  const generated =
    [...codes];

  const {
    data: existingCards,
    error,
  } =
    await supabase
      .from('cards')
      .select('code')
      .in(
        'code',
        generated
      );

  if (error) {
    throw new Error(
      `تعذر فحص الأكواد الموجودة: ${error.message}`
    );
  }

  const existing =
    new Set(
      (existingCards || [])
        .map(
          (card) =>
            card.code
        )
    );

  if (
    existing.size > 0
  ) {
    return generateUniqueCodes(
      prefix,
      totalLength,
      quantity,
      supabase
    );
  }

  return generated;
}

/* =========================================================
   MikroTik User Creation
   ========================================================= */

async function createMikrotikUser(
  code,
  profileName,
  config = null
) {
  let createdUser = null;

  try {
    createdUser =
      await mikrotikRequest(
        'user-manager/user',
        {
          method: 'PUT',
          body: JSON.stringify({
            name: code,
            password: code,
            'shared-users':
              '1',
          }),
        },
        config
      );

    await mikrotikRequest(
      'user-manager/user-profile',
      {
        method: 'PUT',
        body: JSON.stringify({
          user: code,
          profile:
            profileName,
        }),
      },
      config
    );

    return {
      success: true,
      code,
      user: createdUser,
    };
  } catch (error) {
    /*
     * إذا تم إنشاء المستخدم ولكن فشل ربط الـ Profile،
     * نحاول تنظيف المستخدم.
     */
    if (
      createdUser?.['.id']
    ) {
      try {
        await mikrotikRequest(
          `user-manager/user/${encodeURIComponent(
            createdUser['.id']
          )}`,
          {
            method:
              'DELETE',
          },
          config
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
  const results =
    new Array(
      items.length
    );

  let nextIndex = 0;

  async function runner() {
    while (true) {
      const index =
        nextIndex;

      if (
        index >=
        items.length
      ) {
        return;
      }

      nextIndex += 1;

      try {
        results[index] =
          await worker(
            items[index],
            index
          );
      } catch (error) {
        results[index] = {
          success: false,
          code:
            items[index],
          error:
            error?.message ||
            'خطأ غير معروف.',
        };
      }
    }
  }

  const workers =
    Array.from(
      {
        length:
          Math.min(
            concurrency,
            items.length
          ),
      },
      () => runner()
    );

  await Promise.all(
    workers
  );

  return results;
}

/* =========================================================
   Supabase Cards
   ========================================================= */

async function saveSuccessfulCards(
  supabase,
  packageId,
  successfulCodes
) {
  if (
    !successfulCodes.length
  ) {
    return {
      inserted: [],
      failed: [],
    };
  }

  const rows =
    successfulCodes.map(
      (code) => ({
        code,
        package_id:
          packageId,
        status:
          'available',
      })
    );

  const {
    data,
    error,
  } =
    await supabase
      .from('cards')
      .insert(rows)
      .select(
        'id, code, package_id, status, created_at'
      );

  if (!error) {
    return {
      inserted:
        data || [],
      failed: [],
    };
  }

  /*
   * في حالة وجود تعارض،
   * نحاول إدخال كل كرت بشكل منفصل.
   */
  const inserted = [];
  const failed = [];

  for (
    const row of rows
  ) {
    const {
      data: insertedRow,
      error: insertError,
    } =
      await supabase
        .from('cards')
        .insert(row)
        .select(
          'id, code, package_id, status, created_at'
        )
        .maybeSingle();

    if (insertError) {
      failed.push({
        code:
          row.code,
        error:
          insertError.message,
      });
    } else if (
      insertedRow
    ) {
      inserted.push(
        insertedRow
      );
    }
  }

  return {
    inserted,
    failed,
  };
}

/* =========================================================
   Cleanup MikroTik User
   ========================================================= */

async function deleteMikrotikUser(
  code,
  config = null
) {
  try {
    const users =
      await mikrotikRequest(
        'user-manager/user',
        {
          method:
            'POST',
          body: JSON.stringify({
            '.proplist': [
              '.id',
              'name',
            ],
            '.query': [
              `name=${code}`,
            ],
          }),
        },
        config
      );

    const user =
      Array.isArray(users)
        ? users[0]
        : null;

    if (
      !user?.['.id']
    ) {
      return;
    }

    await mikrotikRequest(
      `user-manager/user/${encodeURIComponent(
        user['.id']
      )}`,
      {
        method:
          'DELETE',
      },
      config
    );
  } catch {
    /*
     * سيتم الإبلاغ عن الكرت كحالة
     * تحتاج reconciliation.
     */
  }
}

/* =========================================================
   GET
   ========================================================= */

export async function GET(request) {
  const auth =
    await authenticateAdmin(
      request
    );

  if (!auth.ok) {
    return auth.response;
  }

  const {
    searchParams,
  } = new URL(
    request.url
  );

  const action =
    searchParams.get(
      'action'
    ) || 'profiles';

  try {
    /*
     * قراءة إعدادات الاتصال
     * بدون إرجاع كلمة المرور.
     */
    if (
      action ===
      'settings'
    ) {
      const settings =
        await getMikrotikSettingsForClient();

      return NextResponse.json({
        success: true,
        ...settings,
      });
    }

    /*
     * اختبار الاتصال.
     */
    if (
      action ===
      'test'
    ) {
      const config =
        await resolveMikrotikConfig();

      const result =
        await testMikrotik(
          config
        );

      return NextResponse.json({
        success: true,
        connected: true,
        source:
          config.source,
        ...result,
      });
    }

    /*
     * تحميل Profiles.
     */
    if (
      action ===
      'profiles'
    ) {
      const config =
        await resolveMikrotikConfig();

      const profiles =
        await getProfiles(
          config
        );

      const supabase =
        getSupabaseAdmin();

      const {
        data: mappings,
        error: mappingError,
      } =
        await supabase
          .from(
            'mikrotik_package_mappings'
          )
          .select(
            'package_id, mikrotik_profile_name'
          );

      if (
        mappingError
      ) {
        return jsonError(
          `تعذر تحميل الربط: ${mappingError.message}`,
          500
        );
      }

      return NextResponse.json({
        success: true,
        profiles,
        mappings:
          mappings || [],
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

/* =========================================================
   POST
   ========================================================= */

export async function POST(request) {
  const auth =
    await authenticateAdmin(
      request
    );

  if (!auth.ok) {
    return auth.response;
  }

  let body;

  try {
    body =
      await request.json();
  } catch {
    return jsonError(
      'بيانات الطلب غير صالحة.',
      400
    );
  }

  const action =
    body?.action;

  try {
    const supabase =
      getSupabaseAdmin();

    /* =====================================================
       حفظ إعدادات MikroTik
       ===================================================== */

    if (
      action ===
      'save-settings'
    ) {
      const settings =
        await saveMikrotikSettings(
          body
        );

      return NextResponse.json({
        success: true,
        ...settings,
      });
    }

    /* =====================================================
       حفظ الربط اليدوي:
       package -> MikroTik profile
       ===================================================== */

    if (
      action ===
      'save-mapping'
    ) {
      const packageId =
        String(
          body.packageId ||
            ''
        ).trim();

      const profileName =
        String(
          body.profileName ||
            ''
        ).trim();

      if (
        !packageId ||
        !profileName
      ) {
        return jsonError(
          'يجب اختيار الباقة والـ Profile.',
          400
        );
      }

      const {
        data: packageRow,
        error: packageError,
      } =
        await supabase
          .from(
            'packages'
          )
          .select('id')
          .eq(
            'id',
            packageId
          )
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
       * داخل User Manager.
       */
      const config =
        await resolveMikrotikConfig();

      const profiles =
        await getProfiles(
          config
        );

      const profileExists =
        profiles.some(
          (profile) =>
            profile.name ===
            profileName
        );

      if (
        !profileExists
      ) {
        return jsonError(
          'الـ Profile المحدد غير موجود حاليًا في User Manager.',
          400
        );
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            'mikrotik_package_mappings'
          )
          .upsert(
            {
              package_id:
                packageId,
              mikrotik_profile_name:
                profileName,
              updated_at:
                new Date().toISOString(),
            },
            {
              onConflict:
                'package_id',
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

    /* =====================================================
       إنشاء كروت حقيقية
       ===================================================== */

    if (
      action ===
      'create-cards'
    ) {
      const packageId =
        String(
          body.packageId ||
            ''
        ).trim();

      const quantity =
        Number(
          body.quantity
        );

      const prefix =
        String(
          body.prefix ||
            ''
        ).trim();

      const codeLength =
        Number(
          body.codeLength
        );

      if (!packageId) {
        return jsonError(
          'يجب اختيار الباقة.',
          400
        );
      }

      if (
        !Number.isInteger(
          quantity
        ) ||
        quantity < 1 ||
        quantity >
          MAX_BATCH
      ) {
        return jsonError(
          `الكمية يجب أن تكون بين 1 و${MAX_BATCH}.`,
          400
        );
      }

      if (
        !prefix ||
        !validateCodeFormat(
          prefix
        )
      ) {
        return jsonError(
          'البداية يجب أن تحتوي على أرقام فقط.',
          400
        );
      }

      if (
        !Number.isInteger(
          codeLength
        ) ||
        codeLength < 4 ||
        codeLength > 32
      ) {
        return jsonError(
          'طول الكرت يجب أن يكون بين 4 و32.',
          400
        );
      }

      if (
        prefix.length >=
        codeLength
      ) {
        return jsonError(
          'طول البداية يجب أن يكون أقل من طول الكرت.',
          400
        );
      }

      const {
        data: packageRow,
        error: packageError,
      } =
        await supabase
          .from(
            'packages'
          )
          .select(
            'id, name, price'
          )
          .eq(
            'id',
            packageId
          )
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
      } =
        await supabase
          .from(
            'mikrotik_package_mappings'
          )
          .select(
            'package_id, mikrotik_profile_name'
          )
          .eq(
            'package_id',
            packageId
          )
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
       * نحمل إعدادات MikroTik مرة واحدة فقط
       * للدفعة كاملة، بدل إعادة قراءتها لكل كرت.
       */
      const config =
        await resolveMikrotikConfig();

      /*
       * نتأكد مرة أخرى أن الـ Profile
       * ما زال موجودًا.
       */
      const profiles =
        await getProfiles(
          config
        );

      const profileExists =
        profiles.some(
          (profile) =>
            profile.name ===
            mapping.mikrotik_profile_name
        );

      if (
        !profileExists
      ) {
        return jsonError(
          'الـ Profile المرتبط بهذه الباقة لم يعد موجودًا في User Manager.',
          400
        );
      }

      /*
       * توليد الأكواد من السيرفر.
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
              mapping.mikrotik_profile_name,
              config
            )
        );

      const successfulCodes =
        mikrotikResults
          .filter(
            (result) =>
              result.success
          )
          .map(
            (result) =>
              result.code
          );

      const failedMikrotik =
        mikrotikResults.filter(
          (result) =>
            !result.success
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
       * بعد نجاحه في MikroTik،
       * نحاول إزالته من MikroTik.
       */
      if (
        saved.failed.length
      ) {
        for (
          const failed of
            saved.failed
        ) {
          await deleteMikrotikUser(
            failed.code,
            config
          );
        }
      }

      return NextResponse.json({
        success: true,

        package: {
          id:
            packageRow.id,
          name:
            packageRow.name,
          price:
            packageRow.price,
        },

        mikrotikProfile:
          mapping.mikrotik_profile_name,

        requested:
          quantity,

        createdInMikrotik:
          successfulCodes.length,

        savedInSupabase:
          saved.inserted.length,

        failed:
          failedMikrotik.length +
          saved.failed.length,

        results: {
          successful:
            saved.inserted.map(
              (card) =>
                card.code
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
