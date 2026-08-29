'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function DistributorWeeklyWinner() {
  const [winners, setWinners] = useState([]);
  const [isWeekendShowTime, setIsWeekendShowTime] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function checkRoleAndWinners() {
      // 1. التحقق مما إذا كان المستخدم مديراً (Admin)
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

      // 2. التحقق من الوقت (الجمعة أو السبت أو عرض دائم عند توفر النتائج)
      const today = new Date();
      const currentDay = today.getDay(); // 5 = الجمعة، 6 = السبت
      const isWeekend = (currentDay === 5 || currentDay === 6);
      setIsWeekendShowTime(isWeekend);

      // 3. جلب الفائزين الحاليين من جدول weekly_winners أو قاعدة البيانات
      fetchCurrentWinners();
    }

    checkRoleAndWinners();
  }, []);

  async function fetchCurrentWinners() {
    const { data, error } = await supabase
      .from('weekly_winners')
      .select('*')
      .order('rank', { ascending: true })
      .limit(3);

    if (!error && data && data.length > 0) {
      setWinners(data);
      setIsWeekendShowTime(true); // إذا وُجدت نتائج معلنة، تظهر فوراً
    }
  }

  // دالة إجراء السحب للمدير مع إرسال التليجرام والواتساب
  async function handleRunWeeklyDraw() {
    setLoading(true);
    setMessage('');

    try {
      // 1. جلب الكروت المباعة التي تحتوي على اسم زبون
      const { data: soldCards, error } = await supabase
        .from('cards')
        .select('customer_name, assigned_to, profiles:assigned_to(full_name)')
        .eq('status', 'sold')
        .not('customer_name', 'is', null);

      if (error || !soldCards || soldCards.length === 0) {
        setMessage('⚠️ لا توجد أسماء زبائن كافية مسجلة في المبيعات');
        setLoading(false);
        return;
      }

      // 2. اختيار 3 فائزين عشوائياً بدون تكرار
      const shuffled = [...soldCards].sort(() => 0.5 - Math.random());
      const selectedWinners = shuffled.slice(0, 3);

      const formattedWinners = selectedWinners.map((w, index) => ({
        rank: index + 1,
        customer_name: w.customer_name,
        distributor_name: w.profiles?.full_name || 'موزع معتمد'
      }));

      // 3. تحديث جدول الفائزين في قاعدة البيانات
      await supabase.from('weekly_winners').delete().neq('id', 0);
      for (const w of formattedWinners) {
        await supabase.from('weekly_winners').insert({
          rank: w.rank,
          customer_name: w.customer_name,
          distributor_name: w.distributor_name,
          created_at: new Date().toISOString()
        });
      }

      setWinners(formattedWinners);
      setIsWeekendShowTime(true);

      // 4. تجهيز النص المختصر والمقبول للتليجرام والواتساب
      const text = `🎉🏆 نتائج السحب الأسبوعي - تواصل\n\nمبروك لعملائنا الفائزين (عبر موقعنا وموزعينا):\n\n🥇 المركز الأول: ${formattedWinners[0]?.customer_name || '—'} (الموزع: ${formattedWinners[0]?.distributor_name || '—'})\n🥈 المركز الثاني: ${formattedWinners[1]?.customer_name || '—'} (الموزع: ${formattedWinners[1]?.distributor_name || '—'})\n🥉 المركز الثالث: ${formattedWinners[2]?.customer_name || '—'} (الموزع: ${formattedWinners[2]?.distributor_name || '—'})\n\nألف مبروك، وترقبوا السحب القادم! 🚀`;

      // 5. إرسال إلى بوت التليجرام
      try {
        await fetch('/api/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        });
      } catch (err) {
        console.error('Telegram error:', err);
      }

      // 6. فتح قناة / تطبيق الواتساب بالرسالة الجاهزة
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');

      setMessage('✓ تم السحب وإرسال الإشعارات بنجاح!');
    } catch (err) {
      console.error(err);
      setMessage('❌ حدث خطأ أثناء إجراء السحب');
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
            background: isWeekendShowTime ? '#10B981' : '#7C3AED',
            color: '#fff',
            padding: '4px 10px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: '700'
          }}>
            {isWeekendShowTime ? '✨ الفائزون معتمدون' : '⏳ قيد التنافس'}
          </span>

          {isAdmin && (
            <button
              onClick={handleRunWeeklyDraw}
              disabled={loading}
              style={{
                background: 'linear-gradient(120deg, #10B981, #059669)',
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
              {loading ? 'جاري السحب...' : '🎲 إجراء السحب'}
            </button>
          )}
        </div>
      </div>

      {message && (
        <div style={{ fontSize: '11.5px', fontWeight: '700', marginBottom: 10, color: message.startsWith('✓') ? '#34D399' : '#F87171' }}>
          {message}
        </div>
      )}

      {isWeekendShowTime || winners.length > 0 ? (
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
