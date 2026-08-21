'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function WeeklyWinnerPanel() {
  const [participants, setParticipants] = useState([]);
  const [selectedWinner, setSelectedWinner] = useState(null);
  const [isWeekendShowTime, setIsWeekendShowTime] = useState(false);

  // دالة حساب رقم الأسبوع لتثبيت الفائز أسبوعياً
  function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  }

  useEffect(() => {
    async function fetchParticipants() {
      // التحقق من اليوم الحالي (5 = الجمعة، 6 = السبت)
      const today = new Date();
      const currentDay = today.getDay();
      const isWeekend = (currentDay === 5 || currentDay === 6);
      setIsWeekendShowTime(isWeekend);

      // حساب تاريخ قبل 7 أيام بالضبط من اللحظة الحالية
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('cards')
        .select('customer_name, sold_at, profiles:assigned_to(full_name)')
        .eq('status', 'sold')
        .not('customer_name', 'is', null)
        .gte('sold_at', oneWeekAgo.toISOString()) // جلب المبيعات خلال آخر 7 أيام فقط
        .order('sold_at', { ascending: false });

      if (error) {
        console.error('Error fetching participants:', error);
      } else {
        const list = data || [];
        setParticipants(list);

        if (list.length > 0) {
          // تثبيت فائز واحد تلقائياً طوال الأسبوع بناءً على رقم الأسبوع والسنة
          const currentYear = today.getFullYear();
          const currentWeek = getWeekNumber(today);
          const seed = currentYear * 100 + currentWeek;
          
          const index = seed % list.length;
          setSelectedWinner(list[index]);
        } else {
          setSelectedWinner(null);
        }
      }
    }
    fetchParticipants();
  }, []);

  return (
    <div className="panel" style={{ marginTop: 20, background: '#fff', borderRadius: '16px', padding: '20px', border: '1px solid #E2E8F0' }}>
      <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1E293B' }}>🏆 إدارة مسابقة السحب الأسبوعي</h3>
          <span style={{ fontSize: '12px', color: '#64748B' }}>
            {isWeekendShowTime ? '🎉 عطلة نهاية الأسبوع - الفائز معتمد هذا الأسبوع' : '⏳ المسابقة جارية - سيظهر الفائز يومي الجمعة والسبت'}
          </span>
        </div>
        <div style={{
          background: isWeekendShowTime ? 'linear-gradient(120deg, #059669, #10B981)' : 'linear-gradient(120deg, #7C3AED, #DB2777)',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: '10px',
          fontWeight: '800',
          fontSize: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
        }}>
          {isWeekendShowTime ? '✨ الفائز معتمد' : '📊 قيد التنافس'}
        </div>
      </div>

      {isWeekendShowTime ? (
        selectedWinner && (
          <div style={{
            background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
            border: '1.5px solid #34D399',
            borderRadius: '14px',
            padding: '16px',
            marginBottom: '15px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '12px', fontWeight: '850', color: '#065F46', marginBottom: '4px' }}>
              🎉 الفائز الثابت في السحب الأسبوعي (يومي الجمعة والسبت):
            </div>
            <div style={{ fontSize: '20px', fontWeight: '900', color: '#047857' }}>
              {selectedWinner.customer_name}
            </div>
            <div style={{ fontSize: '12px', color: '#047857', marginTop: '4px' }}>
              الموزع المسؤول عن الزبون: <strong>{selectedWinner.profiles?.full_name || 'غير محدد'}</strong>
            </div>
          </div>
        )
      ) : (
        <div style={{
          background: '#F8FAFC',
          border: '1px dashed #CBD5E1',
          borderRadius: '14px',
          padding: '16px',
          marginBottom: '15px',
          textAlign: 'center',
          color: '#475569',
          fontSize: '13px'
        }}>
          🔒 سيظهر اسم الفائز الأسبوعي الثابت حصرياً يومي <strong>الجمعة والسبت</strong> بناءً على مبيعات الأسبوع.
        </div>
      )}

      <div style={{ fontSize: '13.5px', fontWeight: '755', color: '#334155', marginBottom: '8px' }}>
        قائمة الزبائن المشاركين هذا الأسبوع ({participants.length}):
      </div>

      {participants.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
          {participants.map((p, index) => (
            <div key={index} style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: '800', fontSize: '13px', color: '#1E293B' }}>{p.customer_name}</div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>عبر الموزع: {p.profiles?.full_name || 'موزع'}</div>
              </div>
              <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                {new Date(p.sold_at).toLocaleDateString('ar-YE')}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '15px', textAlign: 'center', color: '#64748B', fontSize: '13px', background: '#F8FAFC', borderRadius: '10px' }}>
          لا يوجد زبائن مسجلين في السحب خلال الـ 7 أيام الماضية.
        </div>
      )}
    </div>
  );
}
