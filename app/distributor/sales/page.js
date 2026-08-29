'use client';
import { useEffect, useState, useMemo } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

function formatNumericDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

export default function SalesPage() {
  const { profile, loading } = useProfile('distributor');
  const [salesLog, setSalesLog] = useState([]);
  const [myCards, setMyCards] = useState([]);

  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonthNum, setSelectedMonthNum] = useState(String(currentDate.getMonth() + 1).padStart(2, '0'));

  const selectedMonth = `${selectedYear}-${selectedMonthNum}`;

  async function loadData() {
    if (!profile) return;

    // 1. جلب سجلات المبيعات الخاصة بالموزع
    const { data: salesList } = await supabase
      .from('sales_log')
      .select('*')
      .eq('distributor_id', profile.id);

    setSalesLog((salesList || []).sort((a, b) => new Date(b.sold_at) - new Date(a.sold_at)));

    // 2. جلب المخزون الحالي المتبقي لدى الموزع
    const { data: inventoryList } = await supabase
      .from('cards')
      .select('*, packages(name, price)')
      .eq('assigned_to', profile.id)
      .eq('status', 'with_distributor');

    setMyCards(inventoryList || []);
  }

  useEffect(() => { if (profile) loadData(); }, [profile]);

  const filteredSales = useMemo(() => {
    return salesLog.filter(s => s.sold_at && s.sold_at.startsWith(selectedMonth));
  }, [salesLog, selectedMonth]);

  const monthlyRevenue = filteredSales.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  const monthlyCommission = monthlyRevenue * 0.10;
  const remainingInventoryValue = myCards.reduce((sum, card) => sum + (card.packages?.price || 0), 0);

  const salesByPackage = useMemo(() => {
    const data = {};
    filteredSales.forEach((item) => {
      const name = item.package_name || 'غير محدد';
      if (!data[name]) data[name] = { count: 0, revenue: 0 };
      data[name].count += 1;
      data[name].revenue += (Number(item.price) || 0);
    });
    return data;
  }, [filteredSales]);

  if (loading) return null;

  return (
    <div className="app">
      <Sidebar role="distributor" active="/distributor/sales" name={profile?.full_name} />
      <div className="main">
        <h1>سجل المبيعات والتقارير</h1>
        
        {/* اختيار الشهر والسنة */}
        <div style={{ marginBottom: 20, background: '#FFFFFF', padding: 14, borderRadius: 14, border: '1px solid #E2E8F0' }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 8 }}>
            اختر شهر التقرير:
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #CBD5E1', fontWeight: 800, fontSize: 14 }}
            >
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>

            <select 
              value={selectedMonthNum} 
              onChange={(e) => setSelectedMonthNum(e.target.value)}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #CBD5E1', fontWeight: 800, fontSize: 14, direction: 'ltr' }}
            >
              <option value="01">شهر 01</option>
              <option value="02">شهر 02</option>
              <option value="03">شهر 03</option>
              <option value="04">شهر 04</option>
              <option value="05">شهر 05</option>
              <option value="06">شهر 06</option>
              <option value="07">شهر 07</option>
              <option value="08">شهر 08</option>
              <option value="09">شهر 09</option>
              <option value="10">شهر 10</option>
              <option value="11">شهر 11</option>
              <option value="12">شهر 12</option>
            </select>
          </div>
        </div>

        {/* بطاقات الإحصائيات الشهرية الأساسية */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <div style={{ background: '#F3F0FB', padding: '14px', borderRadius: 14, border: '1px solid #DDD6FE' }}>
            <div style={{ fontSize: 11, color: '#6D28D9', fontWeight: 700 }}>مبيعات الشهر ({selectedYear}/{selectedMonthNum})</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#4C1D95', marginTop: 2 }}>{monthlyRevenue.toLocaleString()} <span style={{ fontSize: 11 }}>ر.ي</span></div>
          </div>
          <div style={{ background: '#ECFDF5', padding: '14px', borderRadius: 14, border: '1px solid #A7F3D0' }}>
            <div style={{ fontSize: 11, color: '#047857', fontWeight: 700 }}>عمولتك للشهر (10%)</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#059669', marginTop: 2 }}>{monthlyCommission.toLocaleString()} <span style={{ fontSize: 11 }}>ر.ي</span></div>
          </div>
        </div>

        {/* ملخص مبيعات الباقات للشهر */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <h3>ملخص الباقات المباعة</h3>
          {Object.keys(salesByPackage).length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', padding: '10px 0' }}>لا توجد مبيعات في هذا الشهر</div>
          )}
          {Object.entries(salesByPackage).map(([name, d]) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 13, borderBottom: '1px solid #F3F4F6' }}>
              <span style={{ fontWeight: 600, color: '#374151' }}>{name}</span>
              <span style={{ fontWeight: 800, color: '#111827' }}>{d.count} كرت <span style={{ color: '#6B7280', fontWeight: 500 }}>({d.revenue.toLocaleString()} ر.ي)</span></span>
            </div>
          ))}
        </div>

        {/* تقرير المخزون الحالي */}
        <div className="panel" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 18, padding: 16, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 15, fontWeight: 900, color: '#0F172A' }}>حالة المخزون الحالي</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, background: '#FAF5FF', padding: '12px', borderRadius: 10, border: '1px solid #F3E8FF' }}>
            <span style={{ fontWeight: 600, color: '#6B21A8' }}>قيمة الكروت المتبقية بيدك ({myCards.length} كرت):</span>
            <span style={{ fontWeight: 800, color: '#7E22CE', fontSize: 14 }}>{remainingInventoryValue.toLocaleString()} ر.ي</span>
          </div>
        </div>

        {/* سجل المبيعات المفصل */}
        <div className="panel">
          <h3>سجل المبيعات التفصيلي</h3>
          {filteredSales.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', padding: '10px 0' }}>لا توجد عمليات مسجلة في هذا الشهر</div>
          )}
          {filteredSales.map((item) => (
            <div className="timer-row" key={item.id || item.sold_at} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
              <div>
                <div className="tpkg" style={{ fontWeight: 800, color: '#0F172A' }}>{item.package_name}</div>
                <div style={{ fontSize: 12, color: '#64748B' }}>القيمة: {Number(item.price).toLocaleString()} ر.ي</div>
              </div>
              <div className="tleft mono" style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                {formatNumericDate(item.sold_at)}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
