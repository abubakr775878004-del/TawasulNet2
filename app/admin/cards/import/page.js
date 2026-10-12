
'use client';

import { useCallback, useEffect, useState } from 'react';
import Sidebar from '../../../../components/Sidebar';
import { useProfile } from '../../../../lib/useProfile';
import { supabase } from '../../../../lib/supabase';

const EXCLUDED_PHONE_NUMBERS = new Set(['775878004']);
const PRICE_WORDS = [
  'السعر', 'سعر', 'ريال', 'ريال يمني', 'yemen', 'yer', 'price',
];
const NETWORK_WORDS = [
  'شبكة', 'تواصل', 'الاحباب', 'الأحباب', 'خدمات',
  'الإنترنت', 'الانترنت', 'internet', 'network',
];
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
  return String(value)
    .trim()
    .replace(/^[\s"'`()[\]{}<>]+/, '')
    .replace(/[\s"'`()[\]{}<>.,:;]+$/, '')
    .trim();
}

function isValidCodeFormat(value) {
  const code = cleanCode(value);
  if (!code) return false;
  if (code.length < MIN_CODE_LENGTH || code.length > MAX_CODE_LENGTH) {
    return false;
  }
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

  const context = String(ctx).toLowerCase();
  return PRICE_WORDS.some((word) =>
    context.includes(word.toLowerCase())
  );
}

function isNetworkNumber(value, ctx = '') {
  const number = normalizeDigits(value).replace(/\D/g, '');
  if (!number) return false;
  return EXCLUDED_PHONE_NUMBERS.has(number);
}

function addCode(code, set) {
  const cleaned = cleanCode(code);
  if (!isValidCodeFormat(cleaned)) return;
  if (isPhoneNumber(cleaned)) return;
  set.add(cleaned);
}

function extractByNetworkPattern(text, set) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const isNetworkLine = NETWORK_WORDS.some((word) =>
      lines[i].toLowerCase().includes(word.toLowerCase())
    );

    if (!isNetworkLine) continue;

    for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
      const line = lines[j];

      if (
        PRICE_WORDS.some((word) =>
          line.toLowerCase().includes(word.toLowerCase())
        )
      ) {
        break;
      }

      const candidates = line.match(/[A-Za-z0-9_-]{4,80}/g) || [];

      for (const candidate of candidates) {
        const cleaned = cleanCode(candidate);

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
  const ignored = new Set([
    'price', 'network', 'internet', 'card', 'real', 'yer', 'tawasul',
  ]);

  for (const match of matches) {
    const cleaned = cleanCode(match);

    if (!isValidCodeFormat(cleaned)) continue;
    if (ignored.has(cleaned.toLowerCase())) continue;
    if (isPhoneNumber(cleaned)) continue;

    addCode(cleaned, set);
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

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('ar-YE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseRpcResult(data) {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return { message: data };
    }
  }

  return data || {};
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

  const [batches, setBatches] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');

  const [expandedBatchId, setExpandedBatchId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadPackages() {
      const { data, error: queryError } = await supabase
        .from('packages')
        .select('id, name, price')
        .order('name');

      if (!active) return;

      if (queryError) {
        setError('تعذّر تحميل الباقات: ' + queryError.message);
        return;
      }

      setPackages(data || []);
    }

    loadPackages();

    return () => {
      active = false;
    };
  }, []);

  const loadBatches = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError('');

    try {
      const { data, error: queryError } = await supabase
        .from('card_import_batches')
        .select(`
          id,
          package_id,
          package_name,
          cards_added,
          created_at,
          card_import_batch_cards (
            card_id,
            cards (
              code
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (queryError) throw queryError;

      setBatches(data || []);
    } catch (err) {
      setHistoryError(
        'تعذّر تحميل سجل الاستيراد: ' +
          (err?.message || 'خطأ غير معروف')
      );
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  async function extractCodes() {
    if (!file) return;

    setError('');
    setDone('');
    setCodes([]);
    setBusy(true);
    setProgress('جاري تحميل قارئ الملفات...');

    try {
      const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');

      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

      const arrayBuffer = await file.arrayBuffer();

      setProgress('جاري فتح الملف...');

      const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer,
      }).promise;

      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        setProgress(`جاري قراءة الصفحة ${i} من ${pdf.numPages}...`);

        const page = await pdf.getPage(i);
        const content = await page.getTextContent();

        fullText += content.items.map((item) => item.str).join(' ') + '\n';
      }

      setProgress('جاري استخراج أرقام الكروت...');

      const text = normalizeText(fullText);
      const extracted = new Set();

      extractByNetworkPattern(text, extracted);
      extractNumeric(text, extracted);
      extractAlphaNumeric(text, extracted);

      const uniqueCodes = Array.from(
        new Set(finalFilter(Array.from(extracted)))
      );

      if (uniqueCodes.length === 0) {
        setError(
          'لم يتم العثور على أكواد صالحة. تأكد أن الملف يحتوي على نص وليس صورًا ممسوحة ضوئيًا فقط.'
        );
      } else {
        setCodes(uniqueCodes);
      }
    } catch (err) {
      setError(
        'تعذّرت قراءة الملف: ' +
          (err?.message || 'خطأ غير معروف')
      );
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  function removeCode(code) {
    setCodes((current) => current.filter((item) => item !== code));
  }

  async function confirmImport() {
    if (!packageId || codes.length === 0 || busy) return;

    setError('');
    setDone('');
    setBusy(true);
    setProgress('جاري إضافة الكروت وتسجيل عملية الاستيراد...');

    try {
      /*
       * الدالة الموجودة في قاعدة البيانات مسؤولة عن:
       * 1. تسجيل عملية الاستيراد.
       * 2. إضافة الكروت الجديدة فقط.
       * 3. ربط الكروت المضافة فعليًا بسجل العملية.
       *
       * لا ننفّذ INSERT منفصلًا على cards حتى لا يحدث
       * تعارض أو يفقد سجل الاستيراد علاقته بالكروت.
       */
      const { data, error: rpcError } = await supabase.rpc(
        'create_card_import_batch',
        {
          p_package_id: packageId,
          p_codes: codes,
        }
      );

      if (rpcError) throw rpcError;

      const result = parseRpcResult(data);

      if (result.success === false || result.error) {
        throw new Error(
          result.message || result.error || 'لم تكتمل عملية الاستيراد.'
        );
      }

      const batchId = result.batch_id;
      const addedCount = Number(result.cards_added);

      if (!batchId || !Number.isFinite(addedCount)) {
        throw new Error(
          'استجابت قاعدة البيانات دون بيانات تأكيد الاستيراد المتوقعة. تحقّق من سجل الاستيراد قبل إعادة المحاولة.'
        );
      }

      setDone(
        addedCount > 0
          ? `تمت إضافة ${addedCount} كرت فعليًا وتسجيل عملية الاستيراد بنجاح.`
          : 'اكتملت العملية، لكن لم تتم إضافة كروت جديدة. قد تكون الأكواد موجودة مسبقًا.'
      );

      setCodes([]);
      setFile(null);

      await loadBatches();
    } catch (err) {
      setError(
        'تعذّر إكمال الاستيراد: ' +
          (err?.message || 'خطأ غير معروف') +
          ' إذا لم تتأكد من النتيجة، راجع سجل الاستيراد قبل إعادة المحاولة.'
      );
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  async function confirmDeleteBatch() {
    if (!deleteTarget || deleteBusy) return;

    setDeleteBusy(true);
    setHistoryError('');

    try {
      /*
       * false = حذف سجل الاستيراد وروابطه فقط.
       * لا نطلب حذف الكروت مطلقًا.
       */
      const { data, error: rpcError } = await supabase.rpc(
        'delete_card_import_batch',
        {
          p_batch_id: deleteTarget.id,
          p_delete_cards: false,
        }
      );

      if (rpcError) throw rpcError;

      const result = parseRpcResult(data);

      if (result.success === false || result.error) {
        throw new Error(
          result.message || result.error || 'تعذّر حذف سجل الاستيراد.'
        );
      }

      setDeleteTarget(null);

      if (expandedBatchId === deleteTarget.id) {
        setExpandedBatchId(null);
      }

      setDone(
        'تم حذف سجل الاستيراد فقط. جميع الكروت باقية في النظام.'
      );
      setError('');

      await loadBatches();
    } catch (err) {
      setHistoryError(
        'تعذّر حذف سجل الاستيراد: ' +
          (err?.message || 'خطأ غير معروف')
      );
    } finally {
      setDeleteBusy(false);
    }
  }

  if (loading) return null;

  return (
    <div className="app">
      <Sidebar
        role="admin"
        active="/admin/cards/import"
        name={profile?.full_name}
      />

      <div className="main">
        <h1>استيراد كروت من PDF</h1>

        <p className="greet" style={{ marginBottom: 20 }}>
          يتم استخراج الأكواد على جهازك مباشرة، ثم إضافة الكروت إلى الباقة المحددة.
        </p>

        <div className="panel">
          {error && <div className="error-note">{error}</div>}

          {done && <div className="pending-note">✅ {done}</div>}

          {progress && (
            <div className="pending-note">⏳ {progress}</div>
          )}

          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <input
              type="file"
              accept="application/pdf"
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setError('');
                setDone('');
                setCodes([]);
              }}
              style={{ flex: 1, minWidth: 200 }}
            />

            <button
              className="btn-primary"
              style={{ width: 180 }}
              disabled={!file || busy}
              onClick={extractCodes}
            >
              {busy ? '...جاري القراءة' : 'استخراج الأكواد'}
            </button>
          </div>
        </div>

        {codes.length > 0 && (
          <div className="panel">
            <div className="panel-head">
              <h3>راجع الأكواد قبل الإضافة</h3>
              <span className="muted">
                {codes.length} كود مستخرج
              </span>
            </div>

            <div
              style={{
                maxHeight: 320,
                overflowY: 'auto',
                border: '1.5px solid var(--line)',
                borderRadius: 12,
                padding: 10,
                marginBottom: 16,
              }}
            >
              {codes.map((code) => (
                <div
                  key={code}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 4px',
                  }}
                >
                  <span className="mono" style={{ fontSize: 13 }}>
                    {code}
                  </span>

                  <button
                    type="button"
                    onClick={() => removeCode(code)}
                    disabled={busy}
                    aria-label={`إزالة الكود ${code}`}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--red)',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-end',
                flexWrap: 'wrap',
              }}
            >
              <div
                className="field"
                style={{ marginBottom: 0, width: 240 }}
              >
                <label>أضف الكروت إلى الباقة</label>

                <select
                  value={packageId}
                  onChange={(event) => setPackageId(event.target.value)}
                  disabled={busy}
                >
                  <option value="">اختر باقة</option>

                  {packages.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {item.price} ريال
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="btn-primary"
                style={{ width: 220 }}
                disabled={!packageId || busy || codes.length === 0}
                onClick={confirmImport}
              >
                {busy ? 'جاري الإضافة...' : `تأكيد الإضافة (${codes.length})`}
              </button>
            </div>
          </div>
        )}

        <div className="panel" style={{ marginTop: 24 }}>
          <div
            className="panel-head"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <h3>سجل عمليات الاستيراد</h3>
              <p className="muted" style={{ marginTop: 6 }}>
                سجل كل عملية ناجحة، مع الباقة وعدد الكروت المضافة وأكوادها.
              </p>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={loadBatches}
              disabled={historyLoading}
            >
              {historyLoading ? 'جاري التحديث...' : 'تحديث السجل'}
            </button>
          </div>

          {historyError && (
            <div className="error-note">{historyError}</div>
          )}

          {historyLoading ? (
            <p className="muted">جاري تحميل عمليات الاستيراد...</p>
          ) : batches.length === 0 ? (
            <p className="muted">
              لا توجد عمليات استيراد مسجلة حتى الآن.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {batches.map((batch) => {
                const links = batch.card_import_batch_cards || [];
                const linkedCodes = links
                  .map((link) => link.cards?.code)
                  .filter(Boolean);

                const expanded = expandedBatchId === batch.id;

                return (
                  <div
                    key={batch.id}
                    style={{
                      border: '1px solid var(--line)',
                      borderRadius: 12,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 12,
                      }}
                    >
                      <div style={{ minWidth: 180, flex: 1 }}>
                        <h4 style={{ margin: '0 0 8px' }}>
                          {batch.package_name || 'باقة غير محددة'}
                        </h4>

                        <div className="muted" style={{ fontSize: 13 }}>
                          تاريخ الاستيراد: {formatDate(batch.created_at)}
                        </div>

                        <div
                          style={{
                            marginTop: 8,
                            fontWeight: 700,
                          }}
                        >
                          عدد الكروت المضافة: {batch.cards_added ?? 0}
                        </div>

                        <div className="muted" style={{ marginTop: 5 }}>
                          الأكواد المرتبطة حاليًا: {linkedCodes.length}
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() =>
                            setExpandedBatchId(expanded ? null : batch.id)
                          }
                        >
                          {expanded ? 'إخفاء الأكواد' : 'عرض الأكواد'}
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteTarget(batch)}
                          disabled={deleteBusy}
                          style={{
                            border: '1px solid var(--line)',
                            borderRadius: 8,
                            padding: '8px 12px',
                            background: 'transparent',
                            color: 'var(--red)',
                            cursor: 'pointer',
                            fontWeight: 700,
                          }}
                        >
                          حذف السجل
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div
                        style={{
                          marginTop: 14,
                          padding: 12,
                          borderRadius: 8,
                          background: 'var(--bg, transparent)',
                          border: '1px solid var(--line)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 8,
                            marginBottom: 10,
                          }}
                        >
                          <strong>أكواد هذه العملية</strong>

                          <button
                            type="button"
                            onClick={() =>
                              GenUI.copy(linkedCodes.join('\n'))
                            }
                            disabled={linkedCodes.length === 0}
                            style={{
                              border: '1px solid var(--line)',
                              borderRadius: 8,
                              padding: '6px 10px',
                              background: 'transparent',
                              cursor: 'pointer',
                            }}
                          >
                            نسخ الأكواد
                          </button>
                        </div>

                        {linkedCodes.length === 0 ? (
                          <p className="muted">
                            لا توجد أكواد مرتبطة بهذا السجل حاليًا.
                            قد تكون روابط السجل قد حُذفت سابقًا.
                          </p>
                        ) : (
                          <div
                            style={{
                              maxHeight: 260,
                              overflowY: 'auto',
                              display: 'grid',
                              gridTemplateColumns:
                                'repeat(auto-fill, minmax(150px, 1fr))',
                              gap: 8,
                            }}
                          >
                            {linkedCodes.map((code, index) => (
                              <div
                                key={`${batch.id}-${code}-${index}`}
                                className="mono"
                                style={{
                                  padding: 8,
                                  border: '1px solid var(--line)',
                                  borderRadius: 6,
                                  fontSize: 13,
                                  overflowWrap: 'anywhere',
                                }}
                              >
                                {code}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {deleteTarget && (
          <div
            role="presentation"
            onClick={() => {
              if (!deleteBusy) setDeleteTarget(null);
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              background: 'rgba(0,0,0,0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-import-title"
              onClick={(event) => event.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 440,
                padding: 22,
                borderRadius: 16,
                background: 'var(--panel, #fff)',
                color: 'var(--text, #222)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              }}
            >
              <h3 id="delete-import-title" style={{ marginTop: 0 }}>
                تأكيد حذف سجل الاستيراد
              </h3>

              <p style={{ lineHeight: 1.9 }}>
                هل تريد حذف سجل استيراد باقة{' '}
                <strong>
                  {deleteTarget.package_name || 'غير محددة'}
                </strong>
                ؟
              </p>

              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  lineHeight: 1.9,
                  marginBottom: 18,
                }}
              >
                <div>
                  تاريخ العملية: {formatDate(deleteTarget.created_at)}
                </div>

                <div>
                  عدد الكروت المسجل: {deleteTarget.cards_added ?? 0}
                </div>

                <p style={{ marginBottom: 0, fontWeight: 700 }}>
                  ستُحذف بيانات سجل العملية وروابطها فقط. لن تُحذف الكروت
                  من المخزون، ولن تتغير حالتها أو المبيعات أو الديون أو
                  العمولات أو نتائج السحب الأسبوعي.
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={() => setDeleteTarget(null)}
                  style={{
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  إلغاء
                </button>

                <button
                  type="button"
                  className="btn-primary"
                  disabled={deleteBusy}
                  onClick={confirmDeleteBatch}
                  style={{
                    background: 'var(--red, #c62828)',
                  }}
                >
                  {deleteBusy ? 'جاري الحذف...' : 'حذف السجل فقط'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
