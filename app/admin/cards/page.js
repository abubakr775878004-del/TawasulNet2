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
  const [previewDate, setPreviewDate] = useState('');
  const [previewPackageId, setPreviewPackageId] = useState('');

  const [code, setCode] = useState('');
  const [packageId, setPackageId] = useState('');
  const [error, setError] = useState('');

  const [bulkText, setBulkText] = useState('');
  const [bulkPackageId, setBulkPackageId] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [bulkDone, setBulkDone] = useState('');
  const [deletingId, setDeletingId] = useState(null); // حالة لتحميل الحذف الفردي

  async function loadAll() {
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

  // التصفية المزدوجة (حسب التاريخ وحسب الباقة في نفس الوقت) مع الترتيب من الأحدث للأقدم
  const filteredCards = cards.filter(c => {
    const cardDate = c.created_at ? c.created_at.split('T')[0] : '';
    const matchDate = !previewDate || cardDate === previewDate;
    const matchPackage = !previewPackageId || c.package_id === previewPackageId;
    return matchDate && matchPackage;
  });

  // تحديد المفلتر فقط لحماية المخزون القديم وغير الظاهر
  function toggleAll() {
    if (selected.size === filteredCards.length && filteredCards.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredCards.map(c => c.id)));
    }
  }

  function toggle(id) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  async function addCard(e) {
    e.preventDefault();
    setError('');
    if (!code || !packageId) return;
    const { error: insertError } = await supabase.from('cards').insert({ code, package_id: packageId });
    if (insertError) { setError('تعذّرت الإضافة'); return; }
    setCode('');
    loadAll();
  }

  async function addBulkCards(e) {
    e.preventDefault();
    setBulkError(''); setBulkDone('');
    if (!bulkPackageId) { setBulkError('اختر الباقة'); return; }
    const codes = [...new Set(bulkText.split(/\r?\n/).map((l) => l.trim().replace(/\D/g, '')).filter((c) => c.length >= 5))];
    const { error: insertError, data } = await supabase.from('cards').insert(codes.map((c) => ({ code: c, package_id: bulkPackageId }))).select();
    if (insertError) { setBulkError('خطأ أثناء الإضافة'); return; }
    setBulkDone(`تمت إضافة ${data.length} كرت`);
    setBulkText('');
    loadAll();
  }

  // حذف فردي آمن وسريع لكل كرت عبر زر سلة المهملات
  async function deleteSingleCard(id) {
    if (!confirm('هل أنت متأكد من حذف هذا الكرت نهائياً؟')) return;
    setDeletingId(id);
    const { error } = await supabase.from('cards').delete().eq('id', id);
    setDeletingId(null);
    if (error) {
      alert('فشل حذف الكرت: ' + error.message);
    } else {
      loadAll();
    }
  }

  // الحذف الجماعي للمحدد في الفلترة فقط
  async function deleteSelected() {
    if (selected.size === 0 || !confirm(`هل أنت متأكد من حذف ${selected.size} كرت المحددة نهائياً؟`)) return;
    const { error } = await supabase.from('cards').delete().in('id', Array.from(selected));
    if (error) {
      alert('فشل الحذف الجماعي: ' + error.message);
    } else {
      setSelected(new Set());
      loadAll();
    }
  }

  if (loading) return null;

  return (
    <div className="app">
      <Sidebar role="admin" active="/admin/cards" name={profile.full_name} />
      <div className="main">
        <h1>المخزون والكروت</h1>
        <p className="greet" style={{ marginBottom: 20 }}>إدارة الكروت (تحذف المباعة تلقائياً بعد 24 ساعة)</p>

        {/* إضافة فردية */}
        <div className="panel">
           <div className="panel-head"><h3>إضافة كرت يدويًا</h3></div>
           {error && <div className="error-note">{error}</div>}
           <form onSubmit={addCard} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
             <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 150 }}>
               <label>رقم الكرت</label>
               <input className="mono" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="72419038221501" />
             </div>
             <div className="field" style={{ marginBottom: 0, width: 150 }}>
               <label>الباقة</label>
               <select value={packageId} onChange={(e) => setPackageId(e.target.value)}>
                 <option value="">اختر باقة</option>
                 {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
               </select>
             </div>
             <button className="btn-primary" type="submit">إضافة</button>
           </form>
        </div>

        {/* إضافة جماعية */}
        <div className="panel">
          <div className="panel-head">
            <h3>إضافة مجموعة كروت دفعة واحدة</h3>
            <span className="muted">الصق الأرقام (رقم في كل سطر)</span>
          </div>
          {bulkError && <div className="error-note">{bulkError}</div>}
          {bulkDone && <div className="pending-note">✅ {bulkDone}</div>}
          <form onSubmit={addBulkCards}>
            <textarea className="mono" rows={4} value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder="72419038221501&#10;72419038221502" style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid var(--line)', marginBottom: 10 }} />
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
               <div className="field" style={{ marginBottom: 0, width: 180 }}>
                 <label>الباقة</label>
                 <select value={bulkPackageId} onChange={(e) => setBulkPackageId(e.target.value)}>
                   <option value="">اختر باقة</option>
                   {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                 </select>
               </div>
               <button className="btn-primary" type="submit">إضافة الكل</button>
            </div>
          </form>
        </div>

        {/* معاينة وتصفية الكروت حسب الباقة والتاريخ معاً */}
        <div className="panel" style={{ padding: '16px' }}>
          <div className="panel-head"><h3 style={{ fontSize: '14px' }}>معاينة وتصفية الكروت حسب الباقة والتاريخ</h3></div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select 
              value={previewPackageId} 
              onChange={(e) => setPreviewPackageId(e.target.value)} 
              style={{ padding: 8, borderRadius: 8, border: '1px solid var(--line)', minWidth: 150 }}
            >
              <option value="">كل الباقات</option>
              {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="date" value={previewDate} onChange={(e) => setPreviewDate(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid var(--line)' }} />
            <button onClick={() => { setPreviewDate(''); setPreviewPackageId(''); }} style={{ background: '#e5e7eb', border: 'none', padding: '8px 12px', borderRadius: 8, fontSize: '12px', cursor: 'pointer' }}>إلغاء التصفية</button>
          </div>
        </div>

        {/* الجدول */}
        <div className="panel">
          <div className="panel-head">
            <h3>قائمة الكروت ({filteredCards.length})</h3>
          </div>
          <table>
            <thead>
              <tr>
                <th><input type="checkbox" checked={selected.size === filteredCards.length && filteredCards.length > 0} onChange={toggleAll} /></th>
                <th>الكود</th><th>الباقة</th><th>التاريخ</th><th>الحالة</th><th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredCards.map((c) => (
                <tr key={c.id}>
                  <td><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} /></td>
                  <td className="mono">{c.code}</td>
                  <td>{c.packages?.name}</td>
                  <td>{new Date(c.created_at).toLocaleDateString('ar')}</td>
                  <td><span className={`pill ${statusLabel[c.status]?.[1]}`}>{statusLabel[c.status]?.[0]}</span></td>
                  <td>
                    {/* زر حذف فردي مباشر بجانب كل كرت */}
                    <button 
                      onClick={() => deleteSingleCard(c.id)}
                      disabled={deletingId === c.id}
                      style={{ background: '#EF4444', color: 'white', border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: '12px', cursor: 'pointer' }}
                    >
                      {deletingId === c.id ? '...' : 'حذف'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {selected.size > 0 && (
            <div style={{ marginTop: 15, background: '#FEE2E2', padding: 12, borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold' }}>تم تحديد {selected.size} كرت من النتائج الحالية</span>
              <button onClick={deleteSelected} style={{ background: '#DC2626', color: 'white', padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer' }}>حذف المحدد نهائياً</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
