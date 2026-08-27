'use client';
import { useEffect, useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

export default function ReportsPage() {
  const { profile, loading } = useProfile('admin');
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(true);

  // حالات الإجماليات العامة للشبكة
  const [totalNetworkSalesCount, setTotalNetworkSalesCount] = useState(0);
  const [totalNetworkSalesValue, setTotalNetworkSalesValue] = useState(0);

  // دالة تنسيق الأرقام حتى 9 أرقام كحد أقصى وبدون أرقام عشريّة
  const formatNum = (num) => {
    const val = Math.round(Number(num) || 0);
    return val.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  async function loadReport() {
    setBusy(true);

    let since = null;
    if (filter === 'month') {
      const d = new Date(); d.setDate(d.getDate() - 30);
      since = d.getTime();
    } else if (filter === 'week') {
      const d = new Date(); d.setDate(d.getDate() - 7);
      since = d.getTime();
    }

    // 1. جلب الموزعين، الكروت، والباقات بشكل منفصل لضمان تجنب قيود RLS أو أخطاء الاستعلام المركب
    const [{ data: distributors }, { data: allCards }, { data: allPackages }] = await Promise.all([
      supabase.from('profiles').select('id, full_name').eq('role', 'distributor'),
      supabase.from('cards').select('id, assigned_to, status, updated_at, created_at, package_id, price'),
      supabase.from('packages').select('id, price')
    ]);

    // تحويل الباقات إلى خريطة سهلة الوصول [package_id -> price]
    const pkgPriceMap = {};
    (allPackages || []).forEach(p => {
      pkgPriceMap[p.id] = Number(p.price || 0);
    });

    const map = {};
    (distributors || []).forEach((d) => {
      map[d.id] = { name: d.full_name, heldCount: 0, heldValue: 0, salesCount: 0, salesValue: 0 };
    });

    let netSalesCount = 0;
    let netSalesValue = 0;

    (allCards || []).forEach((c) => {
      if (!c.assigned_to || !map[c.assigned_to]) return;

      // تحديد سعر الكرت إما المباشر أو من الباقة
      const cardPrice = Number(c.price || pkgPriceMap[c.package_id] || 0);

      // 1. الكروت المخزنة عند الموزع (غير مباعة)
      if (c.status === 'available' || c.status === 'with_distributor') {
        map[c.assigned_to].heldCount += 1;
        map[c.assigned_to].heldValue += cardPrice;
      }

      // 2. الكروت المباعة فعلياً مع تطبيق الفلتر الصافي (90%)
      if (c.status === 'sold') {
        const soldDate = new Date(c.updated_at || c.created_at).getTime();
        
        if (!since || soldDate >= since) {
          const adminNetPrice = cardPrice * 0.90; // صافي حق المدير 90%

          map[c.assigned_to].salesCount += 1;
          map[c.assigned_to].salesValue += adminNetPrice;

          netSalesCount += 1;
          netSalesValue += adminNetPrice;
        }
      }
    });

    setTotalNetworkSalesCount(netSalesCount);
    setTotalNetworkSalesValue(netSalesValue);

    const result = Object.values(map).sort((a, b) => b.salesValue - a.salesValue);
    setRows(result);
    setBusy(false);
  }

  useEffect(() => { if (profile) loadReport(); }, [profile, filter]);

  const handlePrintPDF = () => {
    window.print();
  };

  if (loading) return null;

  const filterLabel = { all: 'الكل', month: 'آخر 30 يومًا', week: 'آخر 7 أيام' };

  return (
    <div className="app">
      <Sidebar role="admin" active="/admin/reports" name={profile?.full_name} />
      <div className="main">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
          <div>
            <h1>التقارير</h1>
            <p className="greet">مقارنة أداء الموزعين — الكروت الموجودة عندهم والمبيعات الفعلية (الصافي 90%)</p>
          </div>
          <button
            onClick={handlePrintPDF}
            className="no-print"
            style={{
              padding: '10px 18px', borderRadius: '12px', border: '1.5px solid var(--line)',
              background: '#fff', color: 'var(--ink)', fontWeight: 800, fontSize: '13px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'var(--shadow)'
            }}
          >
            🖨️ طباعة / حفظ PDF
          </button>
        </div>

        {/* أزرار الفلترة الزمنية */}
        <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {['all', 'month', 'week'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '9px 18px', borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 12.5, cursor: 'pointer',
                background: filter === f ? 'linear-gradient(120deg, #0F766E, #14B8A6)' : '#F3F8F6',
                color: filter === f ? '#fff' : '#0F766E',
              }}
            >
              {filterLabel[f]}
            </button>
          ))}
        </div>

        {/* البطاقات العلوية الإجمالية للمبيعات */}
        <div className="grid-stats" style={{ marginBottom: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div className="stat" style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid var(--line)' }}>
            <div className="label" style={{ fontSize: '12px', color: 'var(--ink-soft)', fontWeight: 700 }}>إجمالي الكروت المباعة ({filterLabel[filter]})</div>
            <div className="value" style={{ fontSize: '20px', fontWeight: 900, color: '#0F766E', marginTop: '6px' }}>{totalNetworkSalesCount} كرت</div>
          </div>
          <div className="stat" style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid var(--line)' }}>
            <div className="label" style={{ fontSize: '12px', color: 'var(--ink-soft)', fontWeight: 700 }}>صافي المبلغ المحقق للمدير 90% ({filterLabel[filter]})</div>
            <div className="value mono" style={{ fontSize: '20px', fontWeight: 900, color: '#10B981', marginTop: '6px' }}>{formatNum(totalNetworkSalesValue)} ريال</div>
          </div>
        </div>

        {/* جدول أو قائمة مقارنة الموزعين */}
        <div className="panel">
          <div className="panel-head">
            <h3>مقارنة أداء الموزعين</h3>
            <span className="muted">{rows.length} موزع</span>
          </div>

          {busy && <div style={{ color: 'var(--ink-soft)', fontSize: 13, padding: '10px 0' }}>جاري التحميل...</div>}
          {!busy && rows.length === 0 && <div style={{ color: 'var(--ink-soft)', fontSize: 13, padding: '10px 0' }}>لا توجد بيانات مبيعات خلال هذه الفترة</div>}

          {!busy && rows.map((r, i) => (
            <div
              key={i}
              style={{
                borderTop: i !== 0 ? '1px solid var(--line)' : 'none',
                padding: '14px 4px',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 14.5 }}>{r.name}</div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 700 }}>كروت لديه الآن (غير مباعة)</div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, marginTop: '2px' }}>
                    {r.heldCount} كرت — {formatNum(r.heldValue)} ريال
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 700 }}>المبيعات الفعلية / الصافي ({filterLabel[filter]})</div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#10B981', marginTop: '2px' }}>
                    {r.salesCount} كرت — {formatNum(r.salesValue)} ريال
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: #fff !important;
            color: #000 !important;
          }
          .no-print, .sidebar {
            display: none !important;
          }
          .app, .main {
            display: block !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .panel, .stat {
            background: #fff !important;
            color: #000 !important;
            box-shadow: none !important;
            border: 1px solid #ccc !important;
            margin-bottom: 15px !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
