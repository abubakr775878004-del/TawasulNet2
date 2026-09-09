'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function WeeklyGiveawayBanner() {
  const [weeklyWinner, setWeeklyWinner] = useState(null);

  useEffect(() => {
    async function fetchWeeklyWinner() {
      try {
        // تحديد أسبوع السحب الحالي من قاعدة البيانات
        const { data: weekKey, error: weekError } = await supabase.rpc(
          'get_weekly_draw_friday'
        );

        if (weekError || !weekKey) {
          console.error('Error getting weekly draw week:', weekError);
          setWeeklyWinner(null);
          return;
        }

        // جلب الفائز الرسمي للمركز الأول لهذا الأسبوع
        const { data: winnerData, error: winnerError } = await supabase
          .from('weekly_winners')
          .select(
            'id, week_key, rank, customer_name, distributor_name, draw_at, expires_at'
          )
          .eq('week_key', weekKey)
          .eq('rank', 1)
          .maybeSingle();

        if (winnerError) {
          console.error('Error fetching weekly winner:', winnerError);
          setWeeklyWinner(null);
          return;
        }

        if (!winnerData) {
          setWeeklyWinner(null);
          return;
        }

        // التأكد من أن إعلان النتيجة ما زال داخل فترة الـ 30 ساعة
        const expiresAt = winnerData.expires_at
          ? new Date(winnerData.expires_at).getTime()
          : 0;

        const now = Date.now();

        if (expiresAt && now < expiresAt) {
          setWeeklyWinner(winnerData);
        } else {
          setWeeklyWinner(null);
        }
      } catch (err) {
        console.error('Error fetching weekly winner:', err);
        setWeeklyWinner(null);
      }
    }

    fetchWeeklyWinner();
  }, []);

  return (
    <div
      style={{
        background:
          'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
        borderRadius: '16px',
        padding: '16px 20px',
        color: '#fff',
        marginBottom: '20px',
        boxShadow: '0 8px 20px rgba(49, 46, 129, 0.25)',
        border: '1px solid #4338CA'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6
        }}
      >
        <div
          style={{
            fontSize: '13px',
            fontWeight: 800,
            color: '#A5B4FC'
          }}
        >
          🏆 مسابقة السحب الأسبوعي للزبائن
        </div>

        <div
          style={{
            fontSize: '10.5px',
            background: '#4F46E5',
            color: '#fff',
            padding: '3px 8px',
            borderRadius: 6,
            fontWeight: 700
          }}
        >
          سحب تلقائي
        </div>
      </div>

      {weeklyWinner ? (
        <div
          style={{
            fontSize: '14px',
            lineHeight: 1.6
          }}
        >
          ✨ الفائز في السحب هذا الأسبوع:{' '}
          <strong style={{ color: '#34D399' }}>
            {weeklyWinner.customer_name}
          </strong>

          <span
            style={{
              fontSize: '12px',
              color: '#C7D2FE',
              display: 'block',
              marginTop: 2
            }}
          >
            (تم شراء الكرت عبر الموزع:{' '}
            {weeklyWinner.distributor_name || 'موزع بالشبكة'})
          </span>
        </div>
      ) : (
        <div
          style={{
            fontSize: '13px',
            color: '#E0E7FF'
          }}
        >
          أدخل أسماء زبائنك عند بيع الكروت لتأهيلهم للسحب الأسبوعي
          التلقائي وإعطائهم الجوائز!
        </div>
      )}
    </div>
  );
}
