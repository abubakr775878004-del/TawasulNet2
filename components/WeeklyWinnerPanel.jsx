'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function DistributorWeeklyWinner() {
  const [winners, setWinners] = useState([]);
  const [isTimeToShow, setIsTimeToShow] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function checkRoleAndWinners() {
      // 1. التحقق من صلاحيات المدير
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        if (profile?.role === 'admin') {
          setIsAdmin(true);
        }
      }

      // 2. جلب الفائزين والتحقق من وقت القرعة (خلال آخر 30 ساعة)
      fetchWinnersAndCheckTime();
    }

    checkRoleAndWinners();
  }, []);

  async function fetchWinnersAndCheckTime() {
    const { data, error } = await supabase
      .from('weekly_winners')
      .select('*')
      .order('rank', { ascending: true })
      .limit(3);

    if (!error && data && data.length > 0) {
      setWinners(data);
      const createdAt = new Date(data[0].created_at).getTime();
      const now = new Date().getTime();
      const hoursPassed = (now - createdAt) / (1000 * 60 * 60);

      if (hoursPassed <= 30) {
        setIsTimeToShow(true);
      } else {
        setIsTimeToShow(false);
      }
    } else {
      setWinners([]);
      setIsTimeToShow(false);
    }
  }

  // دالة إرسال إشعار النتائج الرسمية للفائزين
  async function handleSendNotificationOnly() {
    if (winners.length === 0) {
      setMessage('⚠️ لا توجد نتائج فائزين لإرسالها حالياً');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const text = `🎉🏆 نتائج السحب الأسبوعي - تواصل\n\nمبروك لعملائنا الفائزين (عبر موقعنا وموزعينا):\n\n🥇 المركز الأول: ${winners[0]?.customer_name || '—'} (الموزع: ${winners[0]?.distributor_name || '—'})\n🥈 المركز الثاني: ${winners[1]?.customer_name || '—'} (الموزع: ${winners[1]?.distributor_name || '—'})\n🥉 المركز الثالث: ${winners[2]?.customer_name || '—'} (الموزع: ${winners[2]?.distributor_name || '—'})\n\nألف مبروك، وترقبوا السحب القادم! 🚀`;

      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();

      if (data.success) {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        setMessage('✓ تم إرسال الإشعار بنجاح!');
      } else {
        setMessage(`❌ فشل الإرسال: ${data.error || 'خطأ غير معروف'}`);
      }
    } catch (err) {
      console.error(err);
      setMessage('❌ حدث خطأ أثناء إرسال الإشعار');
    } finally {
      setLoading(false);
    }
  }

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: 10 }}>
        <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0 }}>🏆 الفائزون بالسحب الأسبوعي للزبائن</h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            background: isTimeToShow ? '#10B981' : '#7C3AED',
            color: '#fff',
            padding: '4px 10px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: '700'
          }}>
            {isTimeToShow ? '✨ الفائزون معتمدون' : '⏳ قيد التنافس'}
          </span>

          {isAdmin && (
            <button
              onClick={handleSendNotificationOnly}
              disabled={loading}
              style={{
                background: 'linear-gradient(120deg, #3B82F6, #1D4ED8)',
                border: 'none',
                color: '#fff',
                padding: '5px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'جاري الإرسال...' : '📢 إرسال إشعار النتائج'}
            </button>
          )}
        </div>
      </div>

      {message && (
        <div style={{ fontSize: '11.5px', fontWeight: '700', marginBottom: 10, color: message.startsWith('✓') ? '#34D399' : '#F87171' }}>
          {message}
        </div>
      )}

      {isTimeToShow ? (
        winners.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {winners.map((winner, index) => (
              <div key={index} style={{
                background: index === 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                border: index === 0 ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
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
            لا توجد مبيعات مسجلة للسحب.
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
          🔒 سيظهر أسماء الفائزين الثلاثة فور إعلان القرعة ولمدة <strong>30 ساعة</strong>. استمر في بيع الكروت لزيادة فرصة زبائنك!
        </div>
      )}
    </div>
  );
}
