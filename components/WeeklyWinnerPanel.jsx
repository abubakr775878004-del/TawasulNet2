'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function DistributorWeeklyWinner() {
  const [selectedWinner, setSelectedWinner] = useState(null);
  const [isWeekendShowTime, setIsWeekendShowTime] = useState(false);

  useEffect(() => {
    async function fetchWinner() {
      const today = new Date();
      const currentDay = today.getDay(); // 5 = الجمعة، 6 = السبت
      const isWeekend = (currentDay === 5 || currentDay === 6);
      setIsWeekendShowTime(isWeekend);

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      // استعلام لجلب المبيعات مع التعامل مع سياسات الأمان
      const { data, error } = await supabase
        .from('cards')
        .select('customer_name, sold_at, profiles:assigned_to(full_name)')
        .eq('status', 'sold')
        .not('customer_name', 'is', null)
        .gte('sold_at', oneWeekAgo.toISOString())
        .order('sold_at', { ascending: false });

      if (error) {
        console.error('Error fetching winner for distributor:', error.message);
        return;
      }

      if (data && data.length > 0) {
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        const days = Math.floor((today - startOfYear) / (24 * 60 * 60 * 1000));
        const weekNumber = Math.floor(days / 7);
        
        const weeklySeed = today.getFullYear() * 1000 + weekNumber;
        const index = weeklySeed % data.length;
        setSelectedWinner(data[index]);
      } else {
        setSelectedWinner(null);
      }
    }
    fetchWinner();
  }, []);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
      borderRadius: '16px',
      padding: '20px',
      color: '#fff',
      boxShadow: '0 10px 25px rgba(49, 46, 129, 0.2)',
      marginBottom: '20px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0 }}>🏆 مسابقة السحب الأسبوعي للزبائن</h3>
        <span style={{
          background: isWeekendShowTime ? '#10B981' : '#7C3AED',
          color: '#fff',
          padding: '4px 10px',
          borderRadius: '8px',
          fontSize: '11px',
          fontWeight: '700'
        }}>
          {isWeekendShowTime ? '✨ الفائز معتمد' : '⏳ قيد التنافس'}
        </span>
      </div>

      {isWeekendShowTime ? (
        selectedWinner ? (
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            padding: '14px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '11px', color: '#34D399', fontWeight: '700', marginBottom: '4px' }}>
              🎉 الفائز في السحب الأسبوعي لهذا الأسبوع:
            </div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#fff' }}>
              {selectedWinner.customer_name}
            </div>
            <div style={{ fontSize: '11px', color: '#CBD5E1', marginTop: '4px' }}>
              عبر الموزع: <strong>{selectedWinner.profiles?.full_name || 'غير محدد'}</strong>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', fontSize: '12px', color: '#CBD5E1', padding: '10px' }}>
            جاري تحميل الفائز أو لا توجد مبيعات كافية...
          </div>
        )
      ) : (
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px dashed rgba(255, 255, 255, 0.2)',
          borderRadius: '12px',
          padding: '12px',
          textAlign: 'center',
          fontSize: '12px',
          color: '#CBD5E1'
        }}>
          🔒 سيظهر اسم الفائز الثابت حصرياً يومي <strong>الجمعة والسبت</strong>. استمر في بيع الكروت لزيادة فرصة زبائنك!
        </div>
      )}
    </div>
  );
}
