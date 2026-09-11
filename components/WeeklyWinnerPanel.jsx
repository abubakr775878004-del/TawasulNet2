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
const {
data: { user },
} = await supabase.auth.getUser();

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

  // 2. جلب فائزين الأسبوع الحالي فقط
  await fetchWinnersAndCheckTime();
}

checkRoleAndWinners();

}, []);

async function fetchWinnersAndCheckTime() {
try {
/*
* الحصول على مفتاح أسبوع السحب من نفس دالة قاعدة البيانات
* المستخدمة في نظام السحب الرسمي.
*
* هذا يمنع اختلاف حساب الأسبوع بين الواجهة وقاعدة البيانات.
*/
const { data: weekKey, error: weekError } = await supabase.rpc(
'get_weekly_draw_friday'
);

  if (weekError || !weekKey) {
    console.error('Error getting weekly draw week:', weekError);
    setWinners([]);
    setIsTimeToShow(false);
    return;
  }

  const { data, error } = await supabase
    .from('weekly_winners')
    .select(
      'id, week_key, rank, card_id, customer_name, distributor_id, distributor_name, draw_at, expires_at'
    )
    .eq('week_key', weekKey)
    .order('rank', { ascending: true })
    .limit(3);

  if (error) {
    console.error('Error fetching weekly winners:', error);
    setWinners([]);
    setIsTimeToShow(false);
    return;
  }

  if (!data || data.length === 0) {
    /*
     * لم يتم السحب لهذا الأسبوع بعد.
     * لا نعرض أي فائز من أسبوع سابق.
     */
    setWinners([]);
    setIsTimeToShow(false);
    return;
  }

  /*
   * الاعتماد على expires_at الرسمي الموجود في weekly_winners
   * بدل حساب المدة من created_at.
   */
  const expiresAt = data[0]?.expires_at
    ? new Date(data[0].expires_at).getTime()
    : 0;

  const now = Date.now();

  if (expiresAt && now < expiresAt) {
    setWinners(data);
    setIsTimeToShow(true);
  } else {
    /*
     * انتهت مدة عرض النتائج.
     */
    setWinners([]);
    setIsTimeToShow(false);
  }
} catch (err) {
  console.error('Unexpected error fetching weekly winners:', err);
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
  const text = `🎉🏆 نتائج السحب الأسبوعي - تواصل

مبروك لعملائنا الفائزين (عبر موقعنا وموزعينا):

🥇 المركز الأول: ${winners[0]?.customer_name || '—'} (الموزع: ${winners[0]?.distributor_name || '—'})
🥈 المركز الثاني: ${winners[1]?.customer_name || '—'} (الموزع: ${winners[1]?.distributor_name || '—'})
🥉 المركز الثالث: ${winners[2]?.customer_name || '—'} (الموزع: ${winners[2]?.distributor_name || '—'})

ألف مبروك، وترقبوا السحب القادم! 🚀`;

  const res = await fetch('/api/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'weekly_winner',
      content: text,
    }),
  });

  const data = await res.json();

  if (data.success) {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      '_blank'
    );

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

const rankBadges = [
'🥇 المركز الأول',
'🥈 المركز الثاني',
'🥉 المركز الثالث',
];

return (
<div
style={{
background:
'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
borderRadius: '16px',
padding: '20px',
color: '#fff',
boxShadow: '0 10px 25px rgba(49, 46, 129, 0.2)',
marginBottom: '20px',
}}
>
<div
style={{
display: 'flex',
justifyContent: 'space-between',
alignItems: 'center',
marginBottom: '14px',
flexWrap: 'wrap',
gap: 10,
}}
>
<h3
style={{
fontSize: '15px',
fontWeight: '800',
margin: 0,
}}
>
🏆 الفائزون بالسحب الأسبوعي للزبائن
</h3>

    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span
        style={{
          background: isTimeToShow ? '#10B981' : '#7C3AED',
          color: '#fff',
          padding: '4px 10px',
          borderRadius: '8px',
          fontSize: '11px',
          fontWeight: '700',
        }}
      >
        {isTimeToShow
          ? '✨ الفائزون معتمدون'
          : '⏳ قيد التنافس'}
      </span>

      {isAdmin && (
        <button
          onClick={handleSendNotificationOnly}
          disabled={loading}
          style={{
            background:
              'linear-gradient(120deg, #3B82F6, #1D4ED8)',
            border: 'none',
            color: '#fff',
            padding: '5px 12px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: '800',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading
            ? 'جاري الإرسال...'
            : '📢 إرسال إشعار النتائج'}
        </button>
      )}
    </div>
  </div>

  {message && (
    <div
      style={{
        fontSize: '11.5px',
        fontWeight: '700',
        marginBottom: 10,
        color: message.startsWith('✓')
          ? '#34D399'
          : '#F87171',
      }}
    >
      {message}
    </div>
  )}

  {isTimeToShow ? (
    winners.length > 0 ? (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {winners.map((winner, index) => (
          <div
            key={winner.id || index}
            style={{
              background:
                index === 0
                  ? 'rgba(16, 185, 129, 0.15)'
                  : 'rgba(255, 255, 255, 0.08)',
              border:
                index === 0
                  ? '1px solid rgba(16, 185, 129, 0.4)'
                  : '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '12px',
              padding: '12px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '10px',
                  color:
                    index === 0
                      ? '#34D399'
                      : '#A7F3D0',
                  fontWeight: '700',
                  marginBottom: '2px',
                }}
              >
                {rankBadges[index] ||
                  `فائز ${index + 1}`}
              </div>

              <div
                style={{
                  fontSize: '16px',
                  fontWeight: '900',
                  color: '#fff',
                }}
              >
                {winner.customer_name}
              </div>
            </div>

            <div
              style={{
                fontSize: '11px',
                color: '#CBD5E1',
                textAlign: 'left',
              }}
            >
              الموزع:
              <br />
              <strong
                style={{
                  color: '#F1F5F9',
                }}
              >
                {winner.distributor_name ||
                  'غير محدد'}
              </strong>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div
        style={{
          textAlign: 'center',
          fontSize: '12px',
          color: '#CBD5E1',
          padding: '10px',
        }}
      >
        لا توجد نتائج فائزين لهذا الأسبوع.
      </div>
    )
  ) : (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.05)',
        border:
          '1px dashed rgba(255, 255, 255, 0.2)',
        borderRadius: '12px',
        padding: '12px',
        textAlign: 'center',
        fontSize: '12px',
        color: '#CBD5E1',
      }}
    >
      🔒 سيظهر أسماء الفائزين الثلاثة فور إعلان
      القرعة ولمدة <strong>30 ساعة</strong>. استمر
      في بيع الكروت لزيادة فرصة زبائنك!
    </div>
  )}
</div>

);
}
