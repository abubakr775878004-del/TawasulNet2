'use client';
export const dynamic = 'force-dynamic';

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

  // دالة مساعدة لتنسيق التاريخ بشكل هجري أو ميلادي (سنة-شهر-يوم)
  const formatDateString = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // حساب التواريخ الفعلية المعروضة على الأزرار لتوضيح النطاق بدقة
  const now = new Date();
  const date30DaysAgo = new Date(); date30DaysAgo.setDate(now.getDate() - 30);
  const date7DaysAgo = new Date(); date7DaysAgo.setDate(now.getDate() - 7);

  const filterConfig = {
    all: { label: 'جميع الأوقات (الكل)', sub: 'من البداية حتى اليوم' },
    month: { label: 'آخر 30 يوماً', sub: `${formatDateString(date30DaysAgo)} إلى ${formatDateString(now)}` },
    week: { label: 'آخر 7 أيام', sub: `${formatDateString(date7DaysAgo)} إلى ${formatDateString(now)}` }
  };

  async function loadReport() {
    setBusy(true);

    let filterTime = null;
    if (filter === 'month') {
      filterTime = date30DaysAgo.getTime();
    } else if (filter === 'week') {
      filterTime = date7DaysAgo.getTime();
    }

    const [{ data: distributors }, { data: allCards }, { data: payments }] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'distributor'),
      supabase.from('cards').select('*, packages(price)'),
      supabase.from('payments').select('distributor_id, amount')
    ]);

    const paymentsMap = {};
    (payments || []).forEach((p) => {
      paymentsMap[p.distributor_id] = (paymentsMap[p.distributor_id] || 0) + Number(p.amount || 0);
    });

    const map = {};
    (distributors || []).forEach((d) => {
      map[d.id] = {
        name: d.full_name || 'موزع',
        heldCount: 0,
        heldValue: 0,
        salesCount: 0,
        salesValue: 0,
        totalSalesAllTime: 0,
        totalPaid: paymentsMap[d.id] || 0,
        remainingDebt: 0
      };
    });

    let netSalesCount = 0;
    let netSalesValue = 0;

    (allCards || []).forEach((c) => {
      if (!c.assigned_to || !map[c.assigned_to]) return;

      const cardPrice = Number(c.price || c.packages?.price || 0);
      const st = String(c.status || '').toLowerCase().trim();
      const isSold = st === 'sold';

      if (!isSold) {
        map[c.assigned_to].heldCount += 1;
        map[c.assigned_to].heldValue += cardPrice;
      } else {
        const adminNetPriceAllTime = cardPrice * 0.90;
        map[c.assigned_to].totalSalesAllTime += adminNetPriceAllTime;

        const actionDate = new Date(c.updated_at || c.created_at || Date.now()).getTime();

        if (filter === 'all' || !filterTime || actionDate >= filterTime) {
          map[c.assigned_to].salesCount += 1;
          map[c.assigned_to].salesValue += adminNetPriceAllTime;

          netSalesCount += 1;
          netSalesValue += adminNetPriceAllTime;
        }
      }
    });

    Object.keys(map).forEach(id => {
      const dist = map[id];
      const calculatedDebt = Math.max(0, Math.round(dist.totalSalesAllTime - dist.totalPaid));
      dist.remainingDebt = calculatedDebt;
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

  return (
    <div className="app">
      <Sidebar role="admin" active="/admin/reports" name={profile?.full_name} />
      <div className="main" style={{ paddingBottom: '40px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#0F172A', marginBottom: '4px' }}>التقارير الشاملة</h1>
            <p style={{ fontSize: '13.5px', color: '#64748B', fontWeight: 600 }}>مقارنة أداء الموزعين، الكروت الحالية، المبيعات الفعلية، والمستحقات المالية بدقة تامة</p>
          </div>
          <button
            onClick={() => window.print()}
            className="no-print"
            style={{
              padding: '10px 18px', borderRadius: '12px', border: '1px solid #CBD5E1',
              background: '#FFFFFF', color: '#0F172A', fontWeight: 800, fontSize: '13px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            🖨️ طباعة / حفظ PDF
          </button>
        </div>

        {/* خانة الأزرار العلوية المحسنة بتصميم يوضح التواريخ والفترات بدقة */}
        <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '24px' }}>
          {['all', 'month', 'week'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '12px 16px', borderRadius: '14px', border: filter === f ? '2px solid #0F766E' : '1px solid #E2E8F0',
                textAlign: 'right', cursor: 'pointer',
                background: filter === f ? 'linear-gradient(135deg, #F0FDFA, #CCFBF1)' : '#FFFFFF',
                boxShadow: filter === f ? '0 4px 12px rgba(15, 118, 110, 0.1)' : '0 1px 2px rgba(0,0,0,0.02)',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 900, color: filter === f ? '#0F766E' : '#0F172A', marginBottom: '4px' }}>
                {filterConfig[f].label}
              </div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: filter === f ? '#115E59' : '#64748B', fontFamily: 'monospace' }}>
                {filterConfig[f].sub}
              </div>
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ fontSize: '12.5px', color: '#64748B', fontWeight: 700, marginBottom: '8px' }}>إجمالي الكروت المباعة ({filterConfig[filter].label})</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#0F766E' }}>{totalNetworkSalesCount} <span style={{ fontSize: '15px', fontWeight: 700 }}>كرت</span></div>
          </div>
          <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ fontSize: '12.5px', color: '#64748B', fontWeight: 700, marginBottom: '8px' }}>صافي المبلغ المحقق للمدير 90% ({filterConfig[filter].label})</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#10B981' }}>{formatNum(totalNetworkSalesValue)} <span style={{ fontSize: '15px', fontWeight: 700 }}>ريال</span></div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 900, color: '#0F172A', margin: 0 }}>مقارنة أداء الموزعين والمستحقات المالية</h3>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#64748B', background: '#E2E8F0', padding: '4px 10px', borderRadius: '20px' }}>{rows.length} موزع</span>
          </div>

          {busy && <div style={{ padding: '30px', textAlign: 'center', color: '#64748B', fontWeight: 700, fontSize: '14px' }}>جاري تحميل البيانات والحسابات بدقة...</div>}
          {!busy && rows.length === 0 && <div style={{ padding: '30px', textAlign: 'center', color: '#64748B', fontWeight: 700, fontSize: '14px' }}>لا توجد بيانات متاحة للموزعين حالياً</div>}

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {!busy && rows.map((r, i) => (
              <div
                key={i}
                style={{
                  padding: '20px 24px',
                  borderTop: i !== 0 ? '1px solid #F1F5F9' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  background: '#FFFFFF'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 900, fontSize: '16px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0F766E', display: 'inline-block' }}></span>
                    {r.name}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
                  
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px 16px' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, marginBottom: '6px' }}>📦 كروت لديه الآن (في المخزن)</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span style={{ color: '#0F766E', fontWeight: 900 }}>{r.heldCount}</span> <span style={{ fontSize: '11px', color: '#64748B' }}>كرت</span>
                      <span style={{ fontSize: '12px', color: '#CBD5E1' }}>|</span>
                      <span style={{ color: '#0F766E', fontSize: '13px' }}>{formatNum(r.heldValue)} ريال</span>
                    </div>
                  </div>

                  <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px', padding: '12px 16px' }}>
                    <div style={{ fontSize: '11px', color: '#166534', fontWeight: 700, marginBottom: '6px' }}>📈 المبيعات الفعلية ({filterConfig[filter].label})</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#10B981', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span style={{ fontWeight: 900 }}>{r.salesCount}</span> <span style={{ fontSize: '11px', color: '#64748B' }}>كرت</span>
                      <span style={{ fontSize: '12px', color: '#86EFAC' }}>|</span>
                      <span style={{ fontSize: '14px', fontWeight: 900 }}>{formatNum(r.salesValue)} ريال</span>
                    </div>
                  </div>

                  <div style={{ 
                    background: r.remainingDebt > 0 ? '#FEF2F2' : '#F8FAFC', 
                    border: r.remainingDebt > 0 ? '1px solid #FCA5A5' : '1px solid #E2E8F0', 
                    borderRadius: '12px', 
                    padding: '12px 16px' 
                  }}>
                    <div style={{ fontSize: '11px', color: r.remainingDebt > 0 ? '#991B1B' : '#64748B', fontWeight: 800, marginBottom: '6px' }}>
                      💰 المبلغ الصافي المتبقي (الدين)
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: r.remainingDebt > 0 ? '#DC2626' : '#059669', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      {formatNum(r.remainingDebt)} <span style={{ fontSize: '12px', fontWeight: 700 }}>ريال</span>
                    </div>
                  </div>

                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
