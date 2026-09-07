import { RouterOSClient } from 'routeros-client';

function generateRandomCode(length = 8) {
  const chars = '0123456789';
  let result = '';

  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }

  return result;
}

function generateUniqueCodes(count, length) {
  const codes = new Set();

  while (codes.size < count) {
    codes.add(generateRandomCode(length));
  }

  return [...codes];
}

export async function POST(request) {
  let client = null;

  try {
    const body = await request.json();

    const {
      quantity,
      codeLength = 8,
      profile
    } = body;

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
      return Response.json(
        {
          success: false,
          error: 'عدد الكروت يجب أن يكون بين 1 و1000'
        },
        { status: 400 }
      );
    }

    if (!Number.isInteger(codeLength) || codeLength < 4 || codeLength > 16) {
      return Response.json(
        {
          success: false,
          error: 'طول الكود يجب أن يكون بين 4 و16 رقمًا'
        },
        { status: 400 }
      );
    }

    if (!profile || typeof profile !== 'string') {
      return Response.json(
        {
          success: false,
          error: 'يجب تحديد Profile الخاص بـ User Manager'
        },
        { status: 400 }
      );
    }

    const host = process.env.MIKROTIK_HOST;
    const port = Number(process.env.MIKROTIK_PORT || 8728);
    const username = process.env.MIKROTIK_USERNAME;
    const password = process.env.MIKROTIK_PASSWORD;

    if (!host || !username || !password) {
      return Response.json(
        {
          success: false,
          error: 'إعدادات MikroTik غير مكتملة في متغيرات البيئة'
        },
        { status: 500 }
      );
    }

    client = new RouterOSClient({
      host,
      port,
      user: username,
      password,
      timeout: 10000
    });

    await client.connect();

    /*
     * نتأكد أولًا أن الـProfile موجود
     * داخل User Manager.
     */
    const profiles = await client
      .menu('/user-manager/profile')
      .select('.id', 'name')
      .where('name', profile)
      .get();

    if (!profiles || profiles.length === 0) {
      return Response.json(
        {
          success: false,
          error: `Profile غير موجود في User Manager: ${profile}`
        },
        { status: 400 }
      );
    }

    const codes = generateUniqueCodes(quantity, codeLength);

    const created = [];
    const failed = [];

    for (const code of codes) {
      try {
        /*
         * إنشاء User داخل User Manager
         */
        const userResult = await client
          .menu('/user-manager/user')
          .add({
            name: code,
            password: code
          });

        /*
         * ربط المستخدم بالـProfile
         */
        await client
          .menu('/user-manager/user-profile')
          .add({
            user: code,
            profile
          });

        created.push({
          code,
          password: code
        });
      } catch (error) {
        failed.push({
          code,
          error:
            error?.message ||
            'فشل إنشاء المستخدم في User Manager'
        });
      }
    }

    return Response.json({
      success: true,
      profile,
      requested: quantity,
      createdCount: created.length,
      failedCount: failed.length,
      created,
      failed
    });
  } catch (error) {
    console.error('MikroTik User Manager error:', error);

    return Response.json(
      {
        success: false,
        error:
          error?.message ||
          'تعذر الاتصال بـ MikroTik User Manager'
      },
      { status: 500 }
    );
  } finally {
    if (client) {
      try {
        await client.close();
      } catch {}
    }
  }
}
