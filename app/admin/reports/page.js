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

  const [totalNetworkSalesCount, setTotalNetworkSalesCount] = useState(0);
  const [totalNetworkSalesValue, setTotalNetworkSalesValue] = useState(0);

  const formatNum = (num) => {
    const val = Math.round(Number(num) || 0);
    return val.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  async function loadReport() {
    setBusy(true);

    let filterTime = null;
    if (filter === 'month') {
      const d = new Date(); d.setDate(d.getDate() - 30);
      filterTime = d.getTime();
    } else if (filter === 'week') {
      const d = new Date(); d.setDate(d.getDate() - 7);
      filterTime = d.getTime();
    }

    // 1. جلب الموزعين بنفس شرط صفحة الموزعين
    const { data: distributors } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'distributor');

    // 2. جلب الكروت المباعة مع أسعار الباقات تماماً مثل كود الموزعين
    const { data: soldCardsData } = await supabase
      .from('cards')
      .select('assigned_to, status, updated_at, created_at, packages(price)')
      .eq('status', 'sold');

    // 3. جلب جميع الكروت لحساب الكروت الموجودة لديه (غير المباعة)
    const { data: allAssignedCards } = await supabase
      .from('cards')
      .select('assigned_to, status, packages(price)')
      .not('assigned_to', 'is', null);

    // 4. جلب السدادات من جدول payments
    const { data: payments } = await supabase
      .from('payments')
      .select('distributor_id, amount');

    const paymentsMap = {};
    (payments || []).forEach((p) => {
      paymentsMap[p.distributor_id] = (paymentsMap[p.distributor_id] || 0) + Number(p.amount || 0);
    });

    const map = {};
    (distributors || []).forEach((d) => {
      map[d.id] = { 
        name: d.full_name, 
        heldCount: 0, 
        heldValue: 0, 
        salesCount: 0, 
        salesValue: 0,
        totalSalesAllTime: 0,
        totalPaid: paymentsMap[d.id] || 0,
        remainingDebt: Number(d.debt) || 0
      };
    });

    // حساب الكروت الموجودة حالياً عند الموزع
    (allAssignedCards || []).forEach((c) => {
      if (!map[c.assigned_to]) return;
      if (c.status === 'with_distributor' || c.status === 'available') {
        map[c.assigned_to].heldCount += 1;
        map[c.assigned_to].heldValue += Number(c.packages?.price || 0);
      }
    });

    let netSalesCount = 0;
    let netSalesValue = 0;

    // حساب المبيعات الفعلية والديون بناءً على الكروت المباعة
    (soldCardsData || []).forEach((c) => {
      if (!map[c.assigned_to]) return;

      const cardPrice = Number(c.packages?.price || 0);
      const adminNetPriceAllTime = cardPrice * 0.90;

      map[c.assigned_to].totalSalesAllTime += adminNetPriceAllTime;

      const soldDate = new Date(c.updated_at || c.created_at || Date.now()).getTime();

      if (!filterTime || soldDate >= filterTime) {
        map[c.assigned_to].salesCount += 1;
        map[c.assigned_to].salesValue += adminNetPriceAllTime;

        netSalesCount += 1;
        netSalesValue += adminNetPriceAllTime;
      }
    });

    // مطابقة حساب الدين الصافي تماماً لمنطق صفحة الموزعين
    Object.keys(map).forEach(id => {
      const dist = map[id];
      const calculatedDebt = Math.max(0, Math.round(dist.totalSalesAllTime - dist.totalPaid));
      if (dist.remainingDebt === 0 && calculatedDebt > 0) {
        dist.remainingDebt = calculatedDebt;
      }
    });

    setTotalNetworkSalesCount(netSalesCount);
    setTotalNetworkSalesValue(netSalesValue);

    const result = Object.values(map).sort((a, b) => b.salesValue - a.salesValue);
    setRows(result);
    setBusy(false);
  }

  useEffect(() => {
    if (profile) loadReport();
  }, [profile, filter]);

  if (loading) return null;

  const filterLabel = { all: 'الكل', month: 'آخر 30 يومًا', week: 'آخر 7 أيام' };

  return (
    <div className="app">
      <Sidebar role="admin" active="/admin/reports" name={profile?.full_name} />
      <div className="main">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
          <div>
            <h1>التقارير الشاملة</h1>
            <p className="greet">مقارنة أداء الموزعين — الكروت الموجودة عندهم، المبيعات الفعلية، والمستحقات (الدين الصافي)</p>
          </div>
          <button
            onClick={() => window.print()}
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

        <div className="panel">
          <div className="panel-head">
            <h3>مقارنة أداء الموزعين والمستحقات المالية</h3>
            <span className="muted">{rows.length} موزع</span>
          </div>

          {busy && <div style={{ color: 'var(--ink-soft)', fontSize: 13, padding: '10px 0' }}>جاري التحميل...</div>}
          {!busy && rows.length === 0 && <div style={{ color: 'var(--ink-soft)', fontSize: 13, padding: '10px 0' }}>لا توجد بيانات متاحة</div>}

          {!busy && rows.map((r, i) => (
            <div
              key={i}
              style={{
                borderTop: i !== 0 ? '1px solid var(--line)' : 'none',
                padding: '14px 4px',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 14.5, color: '#1e1b4b' }}>{r.name}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 700 }}>كروت لديه الآن (غير مباعة)</div>
                  <div style={{ fontSize: 13, fontWeight: 800, marginTop: '2px' }}>
                    {r.heldCount} كرت — {formatNum(r.heldValue)} ريال
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 700 }}>المبيعات الفعلية / الصافي ({filterLabel[filter]})</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#10B981', marginTop: '2px' }}>
                    {r.salesCount} كرت — {formatNum(r.salesValue)} ريال
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 700 }}>المبلغ الصافي المتبقي (الدين)</div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: r.remainingDebt > 0 ? '#dc2626' : '#059669', marginTop: '2px' }}>
                    {formatNum(r.remainingDebt)} ريال
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
