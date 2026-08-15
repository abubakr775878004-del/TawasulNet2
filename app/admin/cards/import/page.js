'use client';
import { useState } from 'react';
import Sidebar from '../../../../components/Sidebar';
import { useProfile } from '../../../../lib/useProfile';
import { supabase } from '../../../../lib/supabase';

const EXCLUDED_PHONE_NUMBERS = new Set(['775878004']);
const PRICE_WORDS = ['السعر', 'سعر', 'ريال', 'ريال يمني', 'yemen', 'yer', 'price'];
const NETWORK_WORDS = ['شبكة', 'تواصل', 'الاحباب', 'الأحباب', 'خدمات', 'الإنترنت', 'الانترنت', 'internet', 'network'];
const MIN_CODE_LENGTH = 4;
const MAX_CODE_LENGTH = 80;

function normalizeDigits(value) {
  if (!value) return '';
  return String(value)
    .replace(/[٠-٩]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0));
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
  return String(value).trim()
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

function isPriceNumber(value, ctx = '') {
  const number = normalizeDigits(value).replace(/\D/g, '');
  if (!number) return false;
  if (/^\d{1,4}$/.test(number)) return true;
  const c = String(ctx).toLowerCase();
  return PRICE_WORDS.some((w) => c.includes(w.toLowerCase()));
}

function isNetworkNumber(value, ctx = '') {
  const number = normalizeDigits(value).replace(/\D/g, '');
  if (!number) return false;
  if (EXCLUDED_PHONE_NUMBERS.has(number)) return true;
  return false;
}

function addCode(code, set) {
  const cleaned = cleanCode(code);
  if (!isValidCodeFormat(cleaned)) return;
  if (isPhoneNumber(cleaned)) return;
  set.add(cleaned);
}

function extractByNetworkPattern(text, set) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const isNetworkLine = NETWORK_WORDS.some((w) => lines[i].toLowerCase().includes(w.toLowerCase()));
    if (!isNetworkLine) continue;
    for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
      const line = lines[j];
      if (PRICE_WORDS.some((w) => line.toLowerCase().includes(w.toLowerCase()))) break;
      const candidates = line.match(/[A-Za-z0-9_-]{4,80}/g) || [];
      for (const cand of candidates) {
        const cleaned = cleanCode(cand);
        if (!isValidCodeFormat(cleaned)) continue;
        if (isPhoneNumber(cleaned)) continue;
        if (isPriceNumber(cleaned, line)) continue;
        addCode(cleaned, set);
      }
    }
  }
}

function extractNumeric(text, set) {
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
    addCode(number, set);
  }
}

function extractAlphaNumeric(text, set) {
  const matches = text.match(/\b[A-Za-z][A-Za-z0-9_-]{3,79}\b/g) || [];
  const ignored = new Set(['price', 'network', 'internet', 'card', 'real', 'yer', 'tawasul']);
  for (const m of matches) {
    const cleaned = cleanCode(m);
    if (!isValidCodeFormat(cleaned)) continue;
    if (ignored.has(cleaned.toLowerCase())) continue;
    if (isPhoneNumber(cleaned)) continue;
    addCode(cleaned, set);
  }
}

function finalFilter(codes) {
  return codes.filter((c) => {
    const cleaned = cleanCode(c);
    if (!isValidCodeFormat(cleaned)) return false;
    if (isPhoneNumber(cleaned)) return false;
    if (/^\d{1,4}$/.test(cleaned)) return false;
    if (EXCLUDED_PHONE_NUMBERS.has(cleaned)) return false;
    return true;
  });
}

export default function ImportPdfPage() {
  const { profile, loading } = useProfile('admin');
  const [file, setFile] = useState(null);
  const [codes, setCodes] = useState([]);
  const [packageId, setPackageId] = useState('');
  const [packages, setPackages] = useState([]);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  useState(() => {
    supabase.from('packages').select('*').then(({ data }) => setPackages(data || []));
  });

  async function extractCodes() {
    if (!file) return;
    setError(''); setDone(''); setCodes([]);
    setBusy(true);
    setProgress('جاري تحميل قارئ الملفات...');

    try {
      const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

      const arrayBuffer = await file.arrayBuffer();
      setProgress('جاري فتح الملف...');
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        setProgress(`جاري قراءة الصفحة ${i} من ${pdf.numPages}...`);
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map((it) => it.str).join(' ') + '\n';
      }

      setProgress('جاري استخراج أرقام الكروت...');
      const text = normalizeText(fullText);
      const set = new Set();
      extractByNetworkPattern(text, set);
      extractNumeric(text, set);
      extractAlphaNumeric(text, set);

      let uniqueCodes = finalFilter(Array.from(set));
      uniqueCodes = Array.from(new Set(uniqueCodes));

      if (uniqueCodes.length === 0) {
        setError('لم يتم العثور على أي أرقام كروت صالحة داخل الملف. تأكد أن الملف يحتوي على نص وليس صورًا ممسوحة ضوئيًا فقط');
      } else {
        setCodes(uniqueCodes);
      }
    } catch (err) {
      setError('تعذّرت قراءة الملف: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  function removeCode(code) {
    setCodes(codes.filter((c) => c !== code));
  }

  async function confirmImport() {
    if (!packageId || codes.length === 0) return;
    setError(''); setBusy(true);
    const rows = codes.map((c) => ({ code: c, package_id: packageId }));
    const { error: insertError, data } = await supabase.from('cards').insert(rows).select();
    setBusy(false);
    if (insertError) {
      setError('تعذّرت إضافة بعض الكروت — على الأغلب أرقام مكررة موجودة مسبقًا في المخزون');
      return;
    }
    setDone(`تمت إضافة ${data.length} كرت بنجاح إلى المخزون`);
    setCodes([]);
    setFile(null);
  }

  if (loading) return null;

  return (
    <div className="app">
      <Sidebar role="admin" active="/admin/cards/import" name={profile.full_name} />
      <div className="main">
        <h1>استيراد كروت من PDF</h1>
        <p className="greet" style={{ marginBottom: 20 }}>يتم استخراج الأرقام داخل جهازك مباشرة — بدون حد لحجم الملف</p>

        <div className="panel">
          {error && <div className="error-note">{error}</div>}
          {done && <div className="pending-note">✅ {done}</div>}
          {progress && <div className="pending-note">⏳ {progress}</div>}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{ flex: 1, minWidth: 200 }}
            />
            <button className="btn-primary" style={{ width: 180 }} disabled={!file || busy} onClick={extractCodes}>
              {busy ? '...جاري القراءة' : 'استخراج الأكواد'}
            </button>
          </div>
        </div>

        {codes.length > 0 && (
          <div className="panel">
            <div className="panel-head">
              <h3>راجع الأكواد قبل الإضافة</h3>
              <span className="muted">{codes.length} كود مستخرج</span>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto', border: '1.5px solid var(--line)', borderRadius: 12, padding: 10, marginBottom: 16 }}>
              {codes.map((c) => (
                <div key={c} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px' }}>
                  <span className="mono" style={{ fontSize: 13 }}>{c}</span>
                  <button onClick={() => removeCode(c)} style={{ border: 'none', background: 'transparent', color: 'var(--red)', fontWeight: 800, cursor: 'pointer' }}>✕</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="field" style={{ marginBottom: 0, width: 220 }}>
                <label>أضف الكل إلى الباقة</label>
                <select value={packageId} onChange={(e) => setPackageId(e.target.value)}>
                  <option value="">اختر باقة</option>
                  {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <button className="btn-primary" style={{ width: 200 }} disabled={!packageId || busy} onClick={confirmImport}>
                تأكيد الإضافة ({codes.length})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
