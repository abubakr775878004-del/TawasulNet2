'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function DistributorWeeklyWinner() {
  const [winners, setWinners] = useState([]);
  const [isWeekendShowTime, setIsWeekendShowTime] = useState(false);

  useEffect(() => {
    async function fetchWinners() {
      const today = new Date();
      const currentDay = today.getDay(); // 5 = الجمعة، 6 = السبت
      const isWeekend = (currentDay === 5 || currentDay === 6);
      setIsWeekendShowTime(isWeekend);

      if (!isWeekend) return;

      // استدعاء الفائزين من Supabase (دعم حتى 3 فائزين)
      const { data, error } = await supabase.rpc('get_weekly_winner');

      if (!error && data) {
        const winnersList = Array.isArray(data) ? data.slice(0, 3) : [data];
        setWinners(winnersList);
      } else {
        setWinners([]);
      }
    }

    fetchWinners();
  }, []);

  const rankBadges = ['🥇 المركز الأول', '🥈 المركز الثاني', '🥉 المركز الثالث'];

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
      borderRadius: '16px',
      padding: '20px',
      color: '#fff',
      boxShadow: '0 10px 25px rgba(49, 46, 129, 0.2)',
      marginBottom: '20px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0 }}>🏆 الفائزون بالسحب الأسبوعي للزبائن</h3>
        <span style={{
          background: isWeekendShowTime ? '#10B981' : '#7C3AED',
          color: '#fff',
          padding: '4px 10px',
          borderRadius: '8px',
          fontSize: '11px',
          fontWeight: '700'
        }}>
          {isWeekendShowTime ? '✨ الفائزون معتمدون' : '⏳ قيد التنافس'}
        </span>
      </div>

      {isWeekendShowTime ? (
        winners.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {winners.map((winner, index) => (
              <div key={index} style={{
                background: index === 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                border: index === 0 ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                justify: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '10px', color: index === 0 ? '#34D399' : '#A7F3D0', fontWeight: '700', marginBottom: '2px' }}>
                    {rankBadges[index] || `فائز ${index + 1}`}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: '#fff' }}>
                    {winner.customer_name}
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: '#CBD5E1', textAlign: 'left' }}>
                  الموزع: <br />
                  <strong style={{ color: '#F1F5F9' }}>{winner.distributor_name || 'غير محدد'}</strong>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', fontSize: '12px', color: '#CBD5E1', padding: '10px' }}>
            لا توجد مبيعات مسجلة للسحب هذا الأسبوع.
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
          🔒 سيظهر أسماء الفائزين الثلاثة حصرياً يومي <strong>الجمعة والسبت</strong>. استمر في بيع الكروت لزيادة فرصة زبائنك!
        </div>
      )}
    </div>
  );
}
