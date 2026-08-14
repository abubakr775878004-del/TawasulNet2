import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
// يسمح للسيرفر بوقت أطول لمعالجة ملفات PDF الكبيرة (الحد الافتراضي 10 ثواني فقط)
export const maxDuration = 60;

/**
 * قارئ كروت PDF - Tawasul
 */

const EXCLUDED_PHONE_NUMBERS = new Set([
  '775878004',
]);

const PRICE_WORDS = [
  'السعر',
  'سعر',
  'ريال',
  'ريال يمني',
  'yemen',
  'yer',
  'price',
];

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

const MIN_CODE_LENGTH = 4;
const MAX_CODE_LENGTH = 80;

function normalizeDigits(value) {
  if (!value) return '';
  return String(value)
    .replace(/[٠-٩]/g, (char) => String(char.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (char) => String(char.charCodeAt(0) - 0x06f0));
}

function normalizeText(text) {
  return normalizeDigits(text)
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
}

function cleanCode(value) {
  if (!value) return '';
  return String(value)
    .trim()
    .replace(/^[\s"'`()[\]{}<>]+/, '')
    .replace(/[\s"'`()[\]{}<>.,:;]+$/, '')
    .trim();
}

function isValidCodeFormat(value) {
  const code = cleanCode(value);
  if (!code) return false;
  if (code.length < MIN_CODE_LENGTH || code.length > MAX_CODE_LENGTH) return false;
  if (!/^[A-Za-z0-9_-]+$/.test(code)) return false;
  if (!/\d/.test(code)) return false;
  return true;
}

function isPhoneNumber(value) {
  const number = normalizeDigits(value).replace(/\D/g, '');
  if (!number) return false;
  if (EXCLUDED_PHONE_NUMBERS.has(number)) return true;
  if (/^7\d{8}$/.test(number)) return true;
  if (/^07\d{8}$/.test(number)) return true;
  return false;
}

function isPriceNumber(value, surroundingText = '') {
  const number = normalizeDigits(value).replace(/\D/g, '');
  if (!number) return false;
  if (/^\d{1,4}$/.test(number)) return true;
  const context = String(surroundingText).toLowerCase();
  for (const word of PRICE_WORDS) {
    if (context.includes(word.toLowerCase())) return true;
  }
  return false;
}

function isNetworkNumber(value, surroundingText = '') {
  const number = normalizeDigits(value).replace(/\D/g, '');
  if (!number) return false;
  if (EXCLUDED_PHONE_NUMBERS.has(number)) return true;
  const context = String(surroundingText).toLowerCase();
  for (const word of NETWORK_WORDS) {
    if (context.includes(word.toLowerCase())) {
      if (EXCLUDED_PHONE_NUMBERS.has(number)) return true;
    }
  }
  return false;
}

function addCode(code, codesSet) {
  const cleaned = cleanCode(code);
  if (!isValidCodeFormat(cleaned)) return false;
  if (isPhoneNumber(cleaned)) return false;
  if (codesSet.has(cleaned)) return false;
  codesSet.add(cleaned);
  return true;
}

function extractCodesByNetworkPattern(text, codesSet) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];
    const isNetworkLine = NETWORK_WORDS.some((word) =>
      currentLine.toLowerCase().includes(word.toLowerCase())
    );
    if (!isNetworkLine) continue;

    for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
      const candidateLine = lines[j];
      if (PRICE_WORDS.some((word) => candidateLine.toLowerCase().includes(word.toLowerCase()))) {
        break;
      }
      const candidates = candidateLine.match(/[A-Za-z0-9_-]{4,80}/g) || [];
      for (const candidate of candidates) {
        const cleaned = cleanCode(candidate);
        if (!isValidCodeFormat(cleaned)) continue;
        if (isPhoneNumber(cleaned)) continue;
        if (isPriceNumber(cleaned, candidateLine)) continue;
        if (/^[A-Za-z0-9_-]+$/.test(cleaned) && /\d/.test(cleaned)) {
          addCode(cleaned, codesSet);
        }
      }
    }
  }
}

/**
 * نسخة سريعة: تستخدم regex.exec للحصول على موقع كل رقم مباشرة
 * بدل text.indexOf() اللي كانت تعيد البحث بالنص كامل لكل رقم
 * (هذا كان السبب الرئيسي في بطء/توقف الملفات الكبيرة)
 */
function extractNumericCandidates(text, codesSet) {
  const regex = /\b\d{4,80}\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    const index = match.index;
    const number = normalizeDigits(raw);

    if (isPhoneNumber(number)) continue;
    if (number.length <= 4) continue;

    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + raw.length + 50);
    const context = text.slice(start, end);

    if (isPriceNumber(number, context)) continue;
    if (isNetworkNumber(number, context)) continue;

    addCode(number, codesSet);
  }
}

function extractAlphaNumericCandidates(text, codesSet) {
  const matches = text.match(/\b[A-Za-z][A-Za-z0-9_-]{3,79}\b/g) || [];
  const ignoredWords = new Set(['price', 'network', 'internet', 'card', 'real', 'yer', 'tawasul']);

  for (const match of matches) {
    const cleaned = cleanCode(match);
    if (!isValidCodeFormat(cleaned)) continue;
    if (ignoredWords.has(cleaned.toLowerCase())) continue;
    if (isPhoneNumber(cleaned)) continue;
    addCode(cleaned, codesSet);
  }
}

function finalFilter(codes) {
  return codes.filter((code) => {
    const cleaned = cleanCode(code);
    if (!isValidCodeFormat(cleaned)) return false;
    if (isPhoneNumber(cleaned)) return false;
    if (/^\d{1,4}$/.test(cleaned)) return false;
    if (EXCLUDED_PHONE_NUMBERS.has(cleaned)) return false;
    return true;
  });
}

export async function POST(req) {
  try {
    const pdfParseModule = await import('pdf-parse/lib/pdf-parse.js');
    const pdfParse = pdfParseModule.default || pdfParseModule;

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'لم يتم إرفاق ملف PDF' }, { status: 400 });
    }
    if (typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'الملف المرفق غير صالح' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!buffer || buffer.length === 0) {
      return NextResponse.json({ error: 'ملف PDF فارغ' }, { status: 422 });
    }

    const parsed = await pdfParse(buffer);

    if (!parsed || !parsed.text) {
      return NextResponse.json(
        { error: 'لم يتم العثور على نص داخل ملف PDF. إذا كان الملف عبارة عن صور، فسيحتاج إلى OCR.' },
        { status: 422 }
      );
    }

    const text = normalizeText(parsed.text);
    if (!text) {
      return NextResponse.json({ error: 'ملف PDF لا يحتوي على نص قابل للاستخراج.' }, { status: 422 });
    }

    const codesSet = new Set();
    extractCodesByNetworkPattern(text, codesSet);
    extractNumericCandidates(text, codesSet);
    extractAlphaNumericCandidates(text, codesSet);

    let uniqueCodes = Array.from(codesSet);
    uniqueCodes = finalFilter(uniqueCodes);
    uniqueCodes = Array.from(new Set(uniqueCodes));

    if (uniqueCodes.length === 0) {
      return NextResponse.json(
        {
          error: 'لم يتم العثور على أي أرقام كروت صالحة داخل الملف. تأكد أن الملف يحتوي على نص وليس صورًا ممسوحة ضوئيًا فقط.',
          pages: parsed.numpages || 0,
          textLength: text.length,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      codes: uniqueCodes,
      count: uniqueCodes.length,
      pages: parsed.numpages || 0,
    });
  } catch (err) {
    console.error('PDF parsing error:', err);
    return NextResponse.json(
      {
        error: 'تعذّرت قراءة ملف PDF. تأكد أن الملف سليم وأن مكتبة pdf-parse مثبتة بشكل صحيح.',
        details: process.env.NODE_ENV === 'development' ? String(err?.message || err) : undefined,
      },
      { status: 500 }
    );
  }
}
