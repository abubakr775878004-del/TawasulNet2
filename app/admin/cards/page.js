'use client';
import { useEffect, useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

const statusLabel = { available: ['متاح', 'green'], with_distributor: ['مع موزع', 'amber'], sold: ['مباع', 'red'] };

export default function CardsPage() {
  const { profile, loading } = useProfile('admin');
  const [packages, setPackages] = useState([]);
  const [cards, setCards] = useState([]);
  const [selected, setSelected] = useState(new Set());
  
  // حقل فلترة التاريخ لعرض ومعاينة الكروت قبل الحذف
  const [previewDate, setPreviewDate] = useState('');

  const [code, setCode] = useState('');
  const [packageId, setPackageId] = useState('');
  const [error, setError] = useState('');

  const [bulkText, setBulkText] = useState('');
  const [bulkPackageId, setBulkPackageId] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [bulkDone, setBulkDone] = useState('');

  async function loadAll() {
    // حذف الكروت المباعة تلقائياً بعد مرور 24 ساعة (أو يوم واحد) حسب رغبتك
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);
    await supabase.from('cards').delete().eq('status', 'sold').lt('sold_at', oneDayAgo.toISOString());

    const [{ data: pkgs }, { data: crds }] = await Promise.all([
      supabase.from('packages').select('*'),
      supabase.from('cards').select('*, packages(name)').order('created_at', { ascending: false }).limit(200),
    ]);
    setPackages(pkgs || []);
    setCards(crds || []);
  }

  useEffect(() => { if (profile) loadAll(); }, [profile]);

  async function addCard(e) {
    e.preventDefault();
    setError('');
    if (!code || !packageId) return;
    const { error: insertError } = await supabase.from('cards').insert({ code, package_id: packageId });
    if (insertError) { setError('تعذّرت إضافة الكرت — تأكد أن الرقم غير مكرر'); return; }
    setCode('');
    loadAll();
  }

  async function addBulkCards(e) {
    e.preventDefault();
    setBulkError(''); setBulkDone('');
    if (!bulkPackageId) { setBulkError('اختر الباقة أولًا'); return; }

    const codes = [...new Set(
      bulkText.split(/\r?\n/).map((line) => line.trim().replace(/\D/g, '')).filter((c) => c.length >= 5)
    )];
    if (codes.length === 0) { setBulkError('لم يتم العثور على أي أرقام كروت صالحة'); return; }

    const rows = codes.map((c) => ({ code: c, package_id: bulkPackageId }));
    const { error: insertError, data } = await supabase.from('cards').insert(rows).select();

    if (insertError) {
      setBulkError('تعذّرت إضافة بعض الكروت — تأكد من عدم تكرار الأرقام.');
      return;
    }
    setBulkDone(`تمت إضافة ${data.length} كرت بنجاح`);
    setBulkText('');
    loadAll();
  }

  function toggle(id) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  async function deleteSelected() {
    if (selected.size === 0 || !confirm('هل أنت متأكد من حذف الكروت المحددة نهائياً؟')) return;
    await supabase.from('cards').delete().in('id', Array.from(selected));
    setSelected(new Set());
    loadAll();
  }

  // تصفية الكروت بناءً على التاريخ المختار للمعاينة
  const filteredCards = cards.filter(c => {
    if (!previewDate) return true;
    const cardDate = c.created_at ? c.created_at.split('T')[0] : '';
    return cardDate === previewDate;
  });

  if (loading) return null;

  return (
    <div className="app">
      <Sidebar role="admin" active="/admin/cards" name={profile.full_name} />
      <div className="main">
        <h1>المخزون والكروت</h1>
        <p className="greet" style={{ marginBottom: 20 }}>إدارة الكروت والمخزون (تختفي الكروت المباعة تلقائياً بعد 24 ساعة)</p>

        {/* قسم إضافة كرت يدويًا (بخانة مصغرة وأنيقة) */}
        <div className="panel" style={{ padding: '16px' }}>
          <div className="panel-head" style={{ marginBottom: 8 }}><h3 style={{ fontSize: '14px' }}>إضافة كرت يدويًا</h3></div>
          {error && <div className="error-note">{error}</div>}
          <form onSubmit={addCard} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input 
              className="mono" 
              value={code} 
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} 
              placeholder="رقم الكرت" 
              style={{ width: '180px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '13px' }}
            />
            <select 
              value={packageId} 
              onChange={(e) => setPackageId(e.target.value)}
              style={{ width: '150px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '13px' }}
            >
              <option value="">اختر الباقة</option>
              {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button className="btn-primary" style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', width: 'auto' }} type="submit">إضافة</button>
          </form>
        </div>

        {/* قسم إضافة مجموعة كروت دفعة واحدة */}
        <div className="panel">
          <div className="panel-head">
            <h3>إضافة مجموعة كروت دفعة واحدة</h3>
            <span className="muted">الصق الأرقام، كل رقم في سطر منفصل</span>
          </div>
          {bulkError && <div className="error-note">{bulkError}</div>}
          {bulkDone && <div className="pending-note">✅ {bulkDone}</div>}
          <form onSubmit={addBulkCards}>
            <div className="field">
              <textarea
                className="mono"
                rows={4}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={'72419038221501\n72419038221502'}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid var(--line)', fontFamily: 'monospace', resize: 'vertical', fontSize: '13px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={bulkPackageId} onChange={(e) => setBulkPackageId(e.target.value)} style={{ width: '180px', padding: '8px', borderRadius: '8px', fontSize: '13px' }}>
                <option value="">اختر الباقة</option>
                {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button className="btn-primary" style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', width: 'auto' }} type="submit">إضافة الكل</button>
            </div>
          </form>
        </div>

        {/* قسم معاينة وفلترة الكروت حسب التاريخ قبل اتخاذ القرار */}
        <div className="panel" style={{ padding: '16px' }}>
          <div className="panel-head" style={{ marginBottom: 8 }}><h3 style={{ fontSize: '14px' }}>معاينة الكروت حسب التاريخ</h3></div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input 
              type="date" 
              value={previewDate} 
              onChange={(e) => setPreviewDate(e.target.value)} 
              style={{ width: '180px', padding: '8px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '13px' }}
            />
            {previewDate && (
              <button 
                onClick={() => setPreviewDate('')} 
                style={{ background: '#e5e7eb', border: 'none', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                إلغاء التصفية وعرض الكل
              </button>
            )}
          </div>
          <p style={{ fontSize: '11.5px', color: 'var(--ink-soft)', marginTop: '6px' }}>اختر التاريخ لعرض الكروت الخاصة به في الجدول أدناه للمعاينة، ثم قم بتحديدها وحذفها بأمان.</p>
        </div>

        {/* جدول الكروت مع خانات التحديد والحذف */}
        <div className="panel">
          <div className="panel-head">
            <h3>قائمة الكروت ({filteredCards.length})</h3>
            <span className="muted">{previewDate ? `معاينة تاريخ: ${previewDate}` : 'آخر الكروت المتاحة'}</span>
          </div>
          <table>
            <thead><tr><th></th><th>الكود</th><th>الباقة</th><th>تاريخ الإضافة</th><th>الحالة</th></tr></thead>
            <tbody>
              {filteredCards.map((c) => {
                const [label, color] = statusLabel[c.status] || ['—', 'amber'];
                return (
                  <tr key={c.id}>
                    <td><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} /></td>
                    <td className="mono">{c.code}</td>
                    <td>{c.packages?.name}</td>
                    <td>{new Date(c.created_at).toLocaleDateString('ar')}</td>
                    <td><span className={`pill ${color}`}>{label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {selected.size > 0 && (
            <div className="del-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FEE2E2', padding: 12, borderRadius: 10, marginTop: 15, border: '1px solid #FCA5A5' }}>
              <span style={{ color: '#991B1B', fontWeight: 'bold', fontSize: '13px' }}>تم تحديد {selected.size} كرت</span>
              <button onClick={deleteSelected} style={{ background: '#DC2626', color: 'white', borderRadius: 8, border: 'none', padding: '8px 16px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>حذف المحدد نهائياً</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
