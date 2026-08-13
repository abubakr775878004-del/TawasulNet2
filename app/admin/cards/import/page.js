'use client';
import { useEffect, useState } from 'react';
import Sidebar from '../../../../components/Sidebar';
import { useProfile } from '../../../../lib/useProfile';
import { supabase } from '../../../../lib/supabase';

export default function ImportPdfPage() {
  const { profile, loading } = useProfile('admin');
  const [packages, setPackages] = useState([]);
  const [packageId, setPackageId] = useState('');
  const [file, setFile] = useState(null);
  const [codes, setCodes] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (!profile) return;
    supabase.from('packages').select('*').then(({ data }) => setPackages(data || []));
  }, [profile]);

  async function extract(e) {
    e.preventDefault();
    setError(''); setDone(null);
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/import-pdf', { method: 'POST', body: fd });
    const data = await res.json();
    setBusy(false);
    if (data.error) { setError(data.error); return; }
    setCodes(data.codes);
  }

  function removeCode(c) {
    setCodes(codes.filter((x) => x !== c));
  }

  async function confirmImport() {
    if (!packageId || codes.length === 0) return;
    setBusy(true);
    const rows = codes.map((code) => ({ code, package_id: packageId }));
    const { error: insertError, data } = await supabase.from('cards').insert(rows).select();
    setBusy(false);
    if (insertError) { setError('حدث خطأ أثناء الإضافة — تحقق من عدم تكرار الأكواد'); return; }
    setDone(data.length);
    setCodes([]);
  }

  if (loading) return null;

  return (
    <div className="app">
      <Sidebar role="admin" active="/admin/cards/import" name={profile.full_name} />
      <div className="main">
        <h1>استيراد كروت من PDF</h1>
        <p className="greet" style={{ marginBottom: 20 }}>ارفع ملف PDF يحتوي على أرقام الكروت وراجعها قبل الإضافة</p>

        <div className="panel">
          {error && <div className="error-note">{error}</div>}
          {done !== null && <div className="pending-note">✅ تم استيراد {done} كرت بنجاح إلى المخزون</div>}
          <form onSubmit={extract} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 220 }}>
              <label>ملف PDF</label>
              <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])} />
            </div>
            <button className="btn-primary" style={{ width: 160 }} type="submit" disabled={busy}>
              {busy ? 'جاري القراءة...' : 'استخراج الأكواد'}
            </button>
          </form>
        </div>

        {codes.length > 0 && (
          <div className="panel">
            <div className="panel-head">
              <h3>راجع الأكواد المستخرجة قبل الإضافة</h3>
              <span className="muted">{codes.length} كود</span>
            </div>
            <div className="field" style={{ maxWidth: 260 }}>
              <label>أضِفها إلى الباقة</label>
              <select value={packageId} onChange={(e) => setPackageId(e.target.value)}>
                <option value="">اختر باقة</option>
                {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 12, padding: 10, margin: '14px 0' }}>
              {codes.map((c) => (
                <div key={c} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 4px', fontSize: 13 }} className="mono">
                  {c}
                  <button onClick={() => removeCode(c)} style={{ border: 'none', background: 'none', color: 'var(--red)', cursor: 'pointer', fontFamily: 'Tajawal' }}>حذف</button>
                </div>
              ))}
            </div>
            <button className="btn-primary" disabled={!packageId || busy} onClick={confirmImport}>
              {busy ? 'جاري الإضافة...' : `تأكيد إضافة ${codes.length} كرت`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
