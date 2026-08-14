import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * قارئ كروت PDF - Tawasul
 *
 * الوظائف:
 * - قراءة ملفات PDF التي تحتوي على نص.
 * - استخراج أكواد الكروت من النص.
 * - دعم أكواد تبدأ برقم أو بحرف إنجليزي.
 * - استبعاد رقم التواصل المتكرر.
 * - استبعاد الأسعار.
 * - استبعاد أرقام الهاتف.
 * - إزالة التكرارات.
 * - التعامل مع اختلاف تنسيق الأسطر والمسافات.
 *
 * مثال من ملفات شبكة تواصل:
 *
 * شبكة تواصل الاحباب
 * 021840130
 * السعر: 500 ريال 775878004
 *
 * النتيجة:
 * 021840130
 *
 * وليس:
 * 500
 * 775878004
 */

/* =========================================================
   إعدادات الاستخراج
   ========================================================= */

/**
 * رقم التواصل الموجود في الملف المرفق.
 *
 * يمكن إضافة أرقام أخرى هنا إذا كانت ملفاتك تستخدم
 * أكثر من رقم ثابت.
 */
const EXCLUDED_PHONE_NUMBERS = new Set([
  '775878004',
]);

/**
 * الكلمات التي تدل على أن الرقم المجاور لها هو سعر
 * وليس كود كرت.
 */
const PRICE_WORDS = [
  'السعر',
  'سعر',
  'ريال',
  'ريال يمني',
  'yemen',
  'yer',
  'price',
];

/**
 * أسماء الشبكات أو الكلمات التي لا تعتبر كود كرت.
 */
const NETWORK_WORDS = [
  'شبكة',
  'تواصل',
  'الاحباب',
  'الأحباب',
  'خدمات',
  'الإنترنت',
  'الانترنت',
  'internet',
  'network',
];

/**
 * أقل وأكبر طول مسموح به لكود الكرت.
 *
 * الكود في الملف المرفق طوله 9 أرقام.
 * تم جعل المجال أوسع حتى يعمل مع ملفات أخرى.
 */
const MIN_CODE_LENGTH = 4;
const MAX_CODE_LENGTH = 80;

/* =========================================================
   أدوات مساعدة
   ========================================================= */

/**
 * تحويل الأرقام العربية/الفارسية إلى أرقام إنجليزية.
 *
 * مثال:
 * ٠٢١٨٤٠١٣٠
 * تصبح:
 * 021840130
 */
function normalizeDigits(value) {
  if (!value) return '';

  return String(value)
    .replace(/[٠-٩]/g, (char) => String(char.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (char) => String(char.charCodeAt(0) - 0x06f0));
}

/**
 * تنظيف النص القادم من PDF.
 */
function normalizeText(text) {
  return normalizeDigits(text)
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
}

/**
 * تنظيف كود الكرت.
 */
function cleanCode(value) {
  if (!value) return '';

  return String(value)
    .trim()
    .replace(/^[\s"'`()[\]{}<>]+/, '')
    .replace(/[\s"'`()[\]{}<>.,:;]+$/, '')
    .trim();
}

/**
 * التحقق من أن النص يبدو ككود كرت.
 *
 * يدعم:
 * - 021840130
 * - 123456
 * - A123456
 * - ABC123456
 *
 * ولا يقبل المسافات داخل الكود.
 */
function isValidCodeFormat(value) {
  const code = cleanCode(value);

  if (!code) return false;

  if (
    code.length < MIN_CODE_LENGTH ||
    code.length > MAX_CODE_LENGTH
  ) {
    return false;
  }

  /**
   * الكود يجب أن يحتوي فقط على:
   * - أحرف إنجليزية
   * - أرقام
   * - ويمكن السماح بشرطة أو underscore داخل الكود
   */
  if (!/^[A-Za-z0-9_-]+$/.test(code)) {
    return false;
  }

  /**
   * يجب أن يحتوي الكود على رقم واحد على الأقل.
   */
  if (!/\d/.test(code)) {
    return false;
  }

  return true;
}

/**
 * التحقق من أن الرقم رقم هاتف معروف.
 *
 * يدعم:
 * 775878004
 * 0775878004
 * 7xxxxxxxx
 * 07xxxxxxxx
 */
function isPhoneNumber(value) {
  const number = normalizeDigits(value).replace(/\D/g, '');

  if (!number) return false;

  if (EXCLUDED_PHONE_NUMBERS.has(number)) {
    return true;
  }

  /**
   * أرقام يمنية شائعة:
   * 7xxxxxxxx
   * 07xxxxxxxx
   */
  if (/^7\d{8}$/.test(number)) {
    return true;
  }

  if (/^07\d{8}$/.test(number)) {
    return true;
  }

  return false;
}

/**
 * التحقق من أن الرقم سعر.
 *
 * نستبعد القيم مثل:
 * 500
 * 200
 * 300
 * 500 ريال
 */
function isPriceNumber(value, surroundingText = '') {
  const number = normalizeDigits(value).replace(/\D/g, '');

  if (!number) return false;

  /**
   * الرقم إذا كان قصيرًا جدًا غالبًا سعر.
   */
  if (/^\d{1,4}$/.test(number)) {
    return true;
  }

  const context = String(surroundingText).toLowerCase();

  for (const word of PRICE_WORDS) {
    if (context.includes(word.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * التحقق من أن النص المحيط بالرقم يدل على أنه رقم شبكة
 * أو رقم ثابت وليس كود كرت.
 */
function isNetworkNumber(value, surroundingText = '') {
  const number = normalizeDigits(value).replace(/\D/g, '');

  if (!number) return false;

  if (EXCLUDED_PHONE_NUMBERS.has(number)) {
    return true;
  }

  const context = String(surroundingText).toLowerCase();

  /**
   * إذا كان الرقم موجودًا بجانب كلمة شبكة أو تواصل
   * فمن الأفضل استبعاده.
   */
  for (const word of NETWORK_WORDS) {
    if (context.includes(word.toLowerCase())) {
      /**
       * لا نستبعد الرقم دائمًا من هنا، لأن بعض الأكواد
       * قد تأتي في نفس السطر مع اسم الشبكة.
       *
       * الاستبعاد النهائي يتم اعتمادًا على موضع الكود.
       */
      if (EXCLUDED_PHONE_NUMBERS.has(number)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * إضافة كود إلى القائمة بدون تكرار.
 */
function addCode(code, codesSet) {
  const cleaned = cleanCode(code);

  if (!isValidCodeFormat(cleaned)) {
    return false;
  }

  if (isPhoneNumber(cleaned)) {
    return false;
  }

  if (codesSet.has(cleaned)) {
    return false;
  }

  codesSet.add(cleaned);

  return true;
}

/* =========================================================
   استخراج الأكواد من الأسطر
   ========================================================= */

/**
 * الطريقة الأولى:
 *
 * الملف المرفق له هذا الشكل:
 *
 * شبكة تواصل الاحباب
 * 021840130
 * السعر: 500 ريال 775878004
 *
 * لذلك الرقم الموجود في السطر التالي لاسم الشبكة
 * يعتبر مرشحًا قويًا جدًا ليكون كود الكرت.
 */
function extractCodesByNetworkPattern(text, codesSet) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];

    const isNetworkLine = NETWORK_WORDS.some((word) =>
      currentLine.toLowerCase().includes(word.toLowerCase())
    );

    if (!isNetworkLine) {
      continue;
    }

    /**
     * نفحص الأسطر التالية مباشرة.
     */
    for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
      const candidateLine = lines[j];

      /**
       * إذا وصلنا إلى سطر السعر نتوقف عن البحث في هذا
       * الجزء.
       */
      if (
        PRICE_WORDS.some((word) =>
          candidateLine.toLowerCase().includes(word.toLowerCase())
        )
      ) {
        break;
      }

      /**
       * البحث عن كود مكوّن من حروف/أرقام.
       */
      const candidates =
        candidateLine.match(/[A-Za-z0-9_-]{4,80}/g) || [];

      for (const candidate of candidates) {
        const cleaned = cleanCode(candidate);

        if (!isValidCodeFormat(cleaned)) {
          continue;
        }

        if (isPhoneNumber(cleaned)) {
          continue;
        }

        if (isPriceNumber(cleaned, candidateLine)) {
          continue;
        }

        /**
         * الأولوية هنا للكود الموجود في سطر منفصل.
         */
        if (
          /^[A-Za-z0-9_-]+$/.test(cleaned) &&
          /\d/.test(cleaned)
        ) {
          addCode(cleaned, codesSet);
        }
      }
    }
  }
}

/* =========================================================
   استخراج الأكواد من الأرقام العامة
   ========================================================= */

/**
 * الطريقة الثانية:
 *
 * نبحث عن جميع الأرقام الموجودة في الملف.
 *
 * هذه الطريقة احتياطية للملفات التي يكون ترتيب النص
 * فيها مختلفًا عن الملف الحالي.
 */
function extractNumericCandidates(text, codesSet) {
  /**
   * نبحث عن أرقام من 4 إلى 80 خانة.
   */
  const matches = text.match(/\b\d{4,80}\b/g) || [];

  for (const match of matches) {
    const number = normalizeDigits(match);

    /**
     * رقم هاتف.
     */
    if (isPhoneNumber(number)) {
      continue;
    }

    /**
     * الأرقام القصيرة تعتبر أسعارًا غالبًا.
     */
    if (number.length <= 4) {
      continue;
    }

    /**
     * نبحث عن موضع الرقم داخل النص لمعرفة السياق.
     */
    const index = text.indexOf(match);

    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + match.length + 50);

    const context = text.slice(start, end);

    if (isPriceNumber(number, context)) {
      continue;
    }

    if (isNetworkNumber(number, context)) {
      continue;
    }

    addCode(number, codesSet);
  }
}

/* =========================================================
   استخراج الأكواد التي تحتوي على أحرف إنجليزية
   ========================================================= */

/**
 * يدعم ملفات تحتوي على أكواد مثل:
 *
 * A123456
 * B20260001
 * CARD12345
 *
 * مع استبعاد الكلمات الإنجليزية العادية.
 */
function extractAlphaNumericCandidates(text, codesSet) {
  const matches =
    text.match(/\b[A-Za-z][A-Za-z0-9_-]{3,79}\b/g) || [];

  const ignoredWords = new Set([
    'price',
    'network',
    'internet',
    'card',
    'real',
    'yer',
    'tawasul',
  ]);

  for (const match of matches) {
    const cleaned = cleanCode(match);

    if (!isValidCodeFormat(cleaned)) {
      continue;
    }

    if (ignoredWords.has(cleaned.toLowerCase())) {
      continue;
    }

    if (isPhoneNumber(cleaned)) {
      continue;
    }

    addCode(cleaned, codesSet);
  }
}

/* =========================================================
   إزالة النتائج غير المرغوبة
   ========================================================= */

function finalFilter(codes) {
  return codes.filter((code) => {
    const cleaned = cleanCode(code);

    if (!isValidCodeFormat(cleaned)) {
      return false;
    }

    if (isPhoneNumber(cleaned)) {
      return false;
    }

    /**
     * لا نريد أسعارًا.
     */
    if (/^\d{1,4}$/.test(cleaned)) {
      return false;
    }

    /**
     * رقم التواصل الثابت.
     */
    if (EXCLUDED_PHONE_NUMBERS.has(cleaned)) {
      return false;
    }

    return true;
  });
}

/* =========================================================
   POST
   ========================================================= */

export async function POST(req) {
  try {
    /**
     * تحميل pdf-parse داخل السيرفر فقط.
     */
    const pdfParseModule = await import(
      'pdf-parse/lib/pdf-parse.js'
    );

    const pdfParse =
      pdfParseModule.default || pdfParseModule;

    /**
     * قراءة FormData.
     */
    const formData = await req.formData();

    const file = formData.get('file');

    if (!file) {
      return NextResponse.json(
        {
          error: 'لم يتم إرفاق ملف PDF',
        },
        {
          status: 400,
        }
      );
    }

    /**
     * التأكد من أن الملف يحتوي على arrayBuffer.
     */
    if (typeof file.arrayBuffer !== 'function') {
      return NextResponse.json(
        {
          error: 'الملف المرفق غير صالح',
        },
        {
          status: 400,
        }
      );
    }

    /**
     * قراءة الملف.
     */
    const buffer = Buffer.from(
      await file.arrayBuffer()
    );

    if (!buffer || buffer.length === 0) {
      return NextResponse.json(
        {
          error: 'ملف PDF فارغ',
        },
        {
          status: 422,
        }
      );
    }

    /**
     * قراءة محتوى PDF.
     */
    const parsed = await pdfParse(buffer);

    /**
     * التأكد من وجود نص.
     */
    if (!parsed || !parsed.text) {
      return NextResponse.json(
        {
          error:
            'لم يتم العثور على نص داخل ملف PDF. إذا كان الملف عبارة عن صور، فسيحتاج إلى OCR.',
        },
        {
          status: 422,
        }
      );
    }

    /**
     * تنظيف النص.
     */
    const text = normalizeText(parsed.text);

    if (!text) {
      return NextResponse.json(
        {
          error:
            'ملف PDF لا يحتوي على نص قابل للاستخراج.',
        },
        {
          status: 422,
        }
      );
    }

    /**
     * Set لمنع التكرار.
     */
    const codesSet = new Set();

    /**
     * -----------------------------------------------------
     * المرحلة الأولى:
     * استخراج الكروت حسب نمط الشبكة.
     * -----------------------------------------------------
     */
    extractCodesByNetworkPattern(
      text,
      codesSet
    );

    /**
     * -----------------------------------------------------
     * المرحلة الثانية:
     * استخراج الأرقام العامة كخطة احتياطية.
     * -----------------------------------------------------
     */
    extractNumericCandidates(
      text,
      codesSet
    );

    /**
     * -----------------------------------------------------
     * المرحلة الثالثة:
     * استخراج الأكواد التي تحتوي على حروف إنجليزية.
     * -----------------------------------------------------
     */
    extractAlphaNumericCandidates(
      text,
      codesSet
    );

    /**
     * تحويل Set إلى Array.
     */
    let uniqueCodes = Array.from(codesSet);

    /**
     * فلترة نهائية.
     */
    uniqueCodes = finalFilter(uniqueCodes);

    /**
     * إزالة التكرارات مرة أخرى كطبقة حماية.
     */
    uniqueCodes = Array.from(
      new Set(uniqueCodes)
    );

    /**
     * إذا لم نجد أي كرت.
     */
    if (uniqueCodes.length === 0) {
      return NextResponse.json(
        {
          error:
            'لم يتم العثور على أي أرقام كروت صالحة داخل الملف. تأكد أن الملف يحتوي على نص وليس صورًا ممسوحة ضوئيًا فقط.',
          pages: parsed.numpages || 0,
          textLength: text.length,
        },
        {
          status: 422,
        }
      );
    }

    /**
     * النتيجة النهائية.
     */
    return NextResponse.json({
      success: true,
      codes: uniqueCodes,
      count: uniqueCodes.length,
      pages: parsed.numpages || 0,
    });
  } catch (err) {
    console.error(
      'PDF parsing error:',
      err
    );

    return NextResponse.json(
      {
        error:
          'تعذّرت قراءة ملف PDF. تأكد أن الملف سليم وأن مكتبة pdf-parse مثبتة بشكل صحيح.',
        details:
          process.env.NODE_ENV === 'development'
            ? String(err?.message || err)
            : undefined,
      },
      {
        status: 500,
      }
    );
  }
}
