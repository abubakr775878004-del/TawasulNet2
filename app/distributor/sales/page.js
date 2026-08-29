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
  const [payments, setPayments] = useState([]);

  // الفلترة الزمنية للأرشيف والتقرير الشهري
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonthNum, setSelectedMonthNum] = useState(String(currentDate.getMonth() + 1).padStart(2, '0'));

  const selectedMonth = `${selectedYear}-${selectedMonthNum}`;

  async function loadData() {
    if (!profile) return;

    // 1. جلب كافة سجلات المبيعات من الأرشيف الدائم (sales_log)
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

    // 3. جلب كافة السدادات والمدفوعات الخاصة بهذا الموزع لضمان مطابقة العهدة
    const { data: paymentList } = await supabase
      .from('payments')
      .select('*')
      .eq('distributor_id', profile.id);

    setPayments(paymentList || []);
  }

  useEffect(() => { if (profile) loadData(); }, [profile]);

  const filteredSales = useMemo(() => {
    return salesLog.filter(s => s.sold_at && s.sold_at.startsWith(selectedMonth));
  }, [salesLog, selectedMonth]);

  // أ. حسابات التقرير الشهري المختار
  const monthlyRevenue = filteredSales.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  const monthlyCommission = monthlyRevenue * 0.10;
  const monthlyNetDue = monthlyRevenue - monthlyCommission;

  // ب. الحسابات التراكمية الشاملة (صندوق العهدة الحقيقي المطابق للمدير)
  const totalAllTimeRevenue = salesLog.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  const totalAllTimeNetDue = totalAllTimeRevenue * 0.90; // مستحقات المدير 90%
  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0); // مجموع المسدد
  const remainingDebt = Math.max(0, totalAllTimeNetDue - totalPaid); // الصافي المتبقي

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
        
        {/* اختيار الشهر والسنة للأرشيف */}
        <div style={{ marginBottom: 20, background: '#FFFFFF', padding: 14, borderRadius: 14, border: '1px solid #E2E8F0' }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 8 }}>
            عرض إحصائيات تقرير شهر (أرقام):
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

        {/* 1. بطاقة صندوق العهدة التراكمي */}
        <div style={{ background: remainingDebt > 0 ? '#1E293B' : '#0F172A', color: '#FFFFFF', padding: 20, borderRadius: 18, marginBottom: 20, boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 700 }}>صندوق العهدة الحقيقي (التراكمي من الأرشيف)</span>
              <h3 style={{ margin: '2px 0 0 0', fontSize: 15, color: '#F8FAFC' }}>إجمالي الدين المطلوب تسليمه للمدير حالياً</h3>
            </div>
            <span style={{ background: remainingDebt > 0 ? '#EF4444' : '#10B981', color: '#FFFFFF', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 20 }}>
              {remainingDebt > 0 ? 'يوجد ذمة غير مسواة' : 'الحساب مصفى 100%'}
            </span>
          </div>

          <div style={{ fontSize: 32, fontWeight: 900, color: remainingDebt > 0 ? '#F87171' : '#34D399', marginTop: 10 }}>
            {remainingDebt.toLocaleString()} <span style={{ fontSize: 14, color: '#94A3B8' }}>ر.ي</span>
          </div>
        </div>

        {/* 2. بطاقات الإحصائيات الشهرية */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <div style={{ background: '#F3F0FB', padding: '14px', borderRadius: 14, border: '1px solid #DDD6FE' }}>
            <div style={{ fontSize: 11, color: '#6D28D9', fontWeight: 700 }}>مبيعات شهر ({selectedYear}/{selectedMonthNum})</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#4C1D95', marginTop: 2 }}>{monthlyRevenue.toLocaleString()} <span style={{ fontSize: 11 }}>ر.ي</span></div>
          </div>
          <div style={{ background: '#ECFDF5', padding: '14px', borderRadius: 14, border: '1px solid #A7F3D0' }}>
            <div style={{ fontSize: 11, color: '#047857', fontWeight: 700 }}>عمولتك للشهر (10%)</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#059669', marginTop: 2 }}>{monthlyCommission.toLocaleString()} <span style={{ fontSize: 11 }}>ر.ي</span></div>
          </div>
        </div>

        {/* 3. ملخص مبيعات الشهر المحدد حسب الباقات */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <h3>ملخص مبيعات شهر ({selectedYear}/{selectedMonthNum})</h3>
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

        {/* 4. تقرير الشهر والمخزون المتبقي */}
        <div className="panel" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 18, padding: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.03)', marginBottom: 20 }}>
          <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: 10, marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#0F172A' }}>تقرير الشهر والمخزون المتبقي</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, background: '#F8FAFC', padding: '10px 12px', borderRadius: 10 }}>
              <span style={{ color: '#475569', fontWeight: 600 }}>إجمالي مبيعات الشهر:</span>
              <span style={{ fontWeight: 900, fontSize: 14, color: '#0F172A' }}>{monthlyRevenue.toLocaleString()} ر.ي</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, background: '#ECFDF5', padding: '10px 12px', borderRadius: 10, border: '1px solid #D1FAE5' }}>
              <span style={{ color: '#065F46', fontWeight: 700 }}>أرباحك المستقطعة للشهر (10%):</span>
              <span style={{ fontWeight: 900, fontSize: 14, color: '#059669' }}>- {monthlyCommission.toLocaleString()} ر.ي</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, background: '#EFF6FF', padding: '10px 12px', borderRadius: 10, border: '1px solid #BFDBFE' }}>
              <span style={{ color: '#1E40AF', fontWeight: 700 }}>الصافي الخاص بهذا الشهر (90%):</span>
              <span style={{ fontWeight: 900, fontSize: 14, color: '#2563EB' }}>{monthlyNetDue.toLocaleString()} ر.ي</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#64748B', background: '#FAF5FF', padding: '10px 12px', borderRadius: 10, border: '1px solid #F3E8FF', marginTop: 2 }}>
              <span style={{ fontWeight: 600, color: '#6B21A8' }}>قيمة الكروت المتبقية بيدك ({myCards.length} كرت):</span>
              <span style={{ fontWeight: 800, color: '#7E22CE', fontSize: 13 }}>{remainingInventoryValue.toLocaleString()} ر.ي</span>
            </div>
          </div>
        </div>

        {/* 5. سجل المبيعات المفصل من الأرشيف */}
        <div className="panel">
          <h3>سجل المبيعات المفصل (الأرشيف الدائم)</h3>
          {filteredSales.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', padding: '10px 0' }}>لا يوجد سجل مبيعات لهذا الشهر</div>
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
