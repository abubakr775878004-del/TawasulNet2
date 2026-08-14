import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

    const formData = await req.formData();
    const file = formData.get('file');
    if (!file) return NextResponse.json({ error: 'لم يتم إرفاق ملف' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const uint8 = new Uint8Array(buffer);

    const loadingTask = pdfjsLib.getDocument({ data: uint8 });
    const pdfDoc = await loadingTask.promise;

    let fullText = '';
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str).join(' ');
      fullText += pageText + '\n';
    }

    const matches = fullText.match(/\b\d{5,16}\b/g) || [];
    const uniqueCodes = [...new Set(matches)];

    if (uniqueCodes.length === 0) {
      return NextResponse.json({ error: 'لم يتم العثور على أي أرقام كروت داخل الملف. تأكد أن الملف يحتوي على نص وليس صورًا ممسوحة ضوئيًا فقط' }, { status: 422 });
    }

    return NextResponse.json({ codes: uniqueCodes });
  } catch (err) {
    return NextResponse.json({ error: 'تعذّرت قراءة الملف. تأكد أنه ملف PDF سليم' }, { status: 500 });
  }
}
