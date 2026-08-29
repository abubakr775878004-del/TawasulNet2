'use client';
import { useEffect, useState, useMemo } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

function formatNumericDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

export default function DistributorSalesPage() {
  const { profile, loading } = useProfile('distributor');
  const [soldCards, setSoldCards] = useState([]);
  const [myCards, setMyCards] = useState([]);

  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(String(currentDate.getFullYear()));
  const [selectedMonthNum, setSelectedMonthNum] = useState(String(currentDate.getMonth() + 1).padStart(2, '0'));

  const selectedMonth = `${selectedYear}-${selectedMonthNum}`;

  async function loadData() {
    if (!profile) return;

    // جلب الكروت المباعة مباشرة من جدول cards بناءً على طريقة النظام المعتمدة
    const { data: cardsData, error } = await supabase
      .from('cards')
      .select('id, sold_at, packages(name, price)')
      .eq('assigned_to', profile.id)
      .eq('status', 'sold');

    if (error) {
      console.error('Error loading sold cards:', error);
    }

    const formattedSales = (cardsData || []).map(c => ({
      id: c.id,
      package_name: c.packages?.name || 'باقة كرت',
      price: Number(c.packages?.price || 0),
      sold_at: c.sold_at || new Date().toISOString()
    }));

    setSoldCards(formattedSales.sort((a, b) => new Date(b.sold_at) - new Date(a.sold_at)));

    // جلب المخزون الحالي المتبقي لدى الموزع
    const { data: inventoryList } = await supabase
      .from('cards')
      .select('*, packages(name, price)')
      .eq('assigned_to', profile.id)
      .eq('status', 'with_distributor');

    setMyCards(inventoryList || []);
  }

  useEffect(() => { 
    if (profile) loadData(); 
  }, [profile]);

  const filteredSales = useMemo(() => {
    return soldCards.filter(s => {
      if (!s.sold_at) return false;
      return s.sold_at.startsWith(selectedMonth);
    });
  }, [soldCards, selectedMonth]);

  const monthlyRevenue = filteredSales.reduce((sum, item) => sum + item.price, 0);
  const monthlyCommission = monthlyRevenue * 0.10; // عمولة الموزع 10%
  const remainingInventoryValue = myCards.reduce((sum, card) => sum + Number(card.packages?.price || 0), 0);

  const salesByPackage = useMemo(() => {
    const data = {};
    filteredSales.forEach((item) => {
      const name = item.package_name;
      if (!data[name]) data[name] = { count: 0, revenue: 0 };
      data[name].count += 1;
      data[name].revenue += item.price;
    });
    return data;
  }, [filteredSales]);

  if (loading || !profile) return null;

  return (
    <div className="app">
      <Sidebar role="distributor" active="/distributor/sales" name={profile.full_name} />
      <div className="main">
        <div className="topbar">
          <div>
            <h1>سجل المبيعات والتقارير</h1>
            <div className="greet">متابعة أرباحك ومبيعاتك الشهرية بدقة</div>
          </div>
        </div>

        {/* اختيار الشهر والسنة */}
        <div style={{ marginBottom: 20, background: '#FFFFFF', padding: 16, borderRadius: 16, border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <label style={{ fontSize: 13, fontWeight: 800, color: '#334155', display: 'block', marginBottom: 8 }}>
            تحديد شهر التقرير:
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
              style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #CBD5E1', fontWeight: 800, fontSize: 14, background: '#F8FAFC' }}
            >
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>

            <select 
              value={selectedMonthNum} 
              onChange={(e) => setSelectedMonthNum(e.target.value)}
              style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #CBD5E1', fontWeight: 800, fontSize: 14, direction: 'ltr', background: '#F8FAFC' }}
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

        {/* بطاقات الإحصائيات الشهرية */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div style={{ background: 'linear-gradient(135deg, #F3F0FB 0%, #EDE9FE 100%)', padding: '16px', borderRadius: 16, border: '1px solid #DDD6FE' }}>
            <div style={{ fontSize: 12, color: '#6D28D9', fontWeight: 800 }}>مبيعات شهر ({selectedYear}/{selectedMonthNum})</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#4C1D95', marginTop: 4 }}>{monthlyRevenue.toLocaleString()} <span style={{ fontSize: 12 }}>ر.ي</span></div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)', padding: '16px', borderRadius: 16, border: '1px solid #A7F3D0' }}>
            <div style={{ fontSize: 12, color: '#047857', fontWeight: 800 }}>عمولتك للشهر (10%)</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#059669', marginTop: 4 }}>{monthlyCommission.toLocaleString()} <span style={{ fontSize: 12 }}>ر.ي</span></div>
          </div>
        </div>

        {/* ملخص الباقات المباعة */}
        <div className="panel" style={{ marginBottom: 20, background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 16 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 15, fontWeight: 900, color: '#0F172A' }}>ملخص الباقات المباعة</h3>
          {Object.keys(salesByPackage).length === 0 ? (
            <div style={{ fontSize: 13, color: '#64748B', padding: '10px 0', textAlign: 'center' }}>لا توجد مبيعات مسجلة في هذا الشهر</div>
          ) : (
            Object.entries(salesByPackage).map(([name, d]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 13, borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ fontWeight: 700, color: '#334155' }}>{name}</span>
                <span style={{ fontWeight: 900, color: '#0F172A' }}>{d.count} كرت <span style={{ color: '#059669', fontWeight: 700 }}>({d.revenue.toLocaleString()} ر.ي)</span></span>
              </div>
            ))
          )}
        </div>

        {/* حالة المخزون الحالي */}
        <div className="panel" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 16, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 15, fontWeight: 900, color: '#0F172A' }}>حالة المخزون الحالي</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, background: '#FAF5FF', padding: '12px 14px', borderRadius: 12, border: '1px solid #F3E8FF' }}>
            <span style={{ fontWeight: 700, color: '#6B21A8' }}>قيمة الكروت المتبقية بيدك ({myCards.length} كرت):</span>
            <span style={{ fontWeight: 900, color: '#7E22CE', fontSize: 15 }}>{remainingInventoryValue.toLocaleString()} ر.ي</span>
          </div>
        </div>

        {/* سجل المبيعات التفصيلي */}
        <div className="panel" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 16 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 15, fontWeight: 900, color: '#0F172A' }}>سجل المبيعات التفصيلي</h3>
          {filteredSales.length === 0 ? (
            <div style={{ fontSize: 13, color: '#64748B', padding: '10px 0', textAlign: 'center' }}>لا توجد عمليات مسجلة في هذا الشهر</div>
          ) : (
            filteredSales.map((item, idx) => (
              <div key={item.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#0F172A' }}>{item.package_name}</div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>القيمة: {Number(item.price).toLocaleString()} ر.ي</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', background: '#F1F5F9', padding: '4px 8px', borderRadius: 8 }}>
                  {formatNumericDate(item.sold_at)}
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
