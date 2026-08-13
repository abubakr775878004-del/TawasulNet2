import { NextResponse } from 'next/server';
import pdf from 'pdf-parse';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file) return NextResponse.json({ error: 'لم يتم إرفاق ملف' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await pdf(buffer);

    // يلتقط أي رقم متتالي مكوّن من 10 إلى 16 خانة (أرقام الكروت التسلسلية بدون فواصل)
    const matches = parsed.text.match(/\b\d{10,16}\b/g) || [];
    const uniqueCodes = [...new Set(matches)];

    return NextResponse.json({ codes: uniqueCodes });
  } catch (err) {
    return NextResponse.json({ error: 'تعذّرت قراءة الملف. تأكد أنه PDF يحتوي على نص وليس صورًا فقط' }, { status: 500 });
  }
}
