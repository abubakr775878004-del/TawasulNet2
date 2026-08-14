import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;

    const formData = await req.formData();
    const file = formData.get('file');
    if (!file) return NextResponse.json({ error: 'لم يتم إرفاق ملف' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await pdfParse(buffer);

    // نلتقط أي رقم من 5 إلى 12 خانة
    const allMatches = parsed.text.match(/\b\d{5,12}\b/g) || [];

    // بعض الملفات فيها رقم تواصل الشبكة مكرر في كل كرت (مثل 775878004)
    // نحسب تكرار كل رقم، ونستبعد أي رقم تكرر أكثر من مرة لأنه غالبًا ليس كود كرت حقيقي
    const counts = {};
    allMatches.forEach((n) => { counts[n] = (counts[n] || 0) + 1; });
    const uniqueCodes = Object.keys(counts).filter((n) => counts[n] === 1);

    if (uniqueCodes.length === 0) {
      return NextResponse.json(
        { error: 'لم يتم العثور على أي أرقام كروت صالحة داخل الملف. تأكد أن الملف يحتوي على نص وليس صورًا ممسوحة ضوئيًا فقط' },
        { status: 422 }
      );
    }

    return NextResponse.json({ codes: uniqueCodes });
  } catch (err) {
    return NextResponse.json(
      { error: 'تعذّرت قراءة الملف. تأكد أنه ملف PDF سليم' },
      { status: 500 }
    );
  }
}
