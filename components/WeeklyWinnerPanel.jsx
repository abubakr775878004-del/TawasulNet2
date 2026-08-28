'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function WeeklyWinnerPanel() {
  const [winner, setWinner] = useState(null);

  useEffect(() => {
    fetchCurrentWinner();
  }, []);

  async function fetchCurrentWinner() {
    try {
      const { data, error } = await supabase
        .from('weekly_winners')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (!error && data) {
        setWinner(data);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // دالة إرسال الإشعار للتلجرام مدمجة مباشرة لتجنب أخطاء الاستيراد
  const sendToTelegram = async (winnersList) => {
    const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
    const chatId = process.env.NEXT_PUBLIC_TELEGRAM_ADMIN_CHAT_ID;

    if (!botToken || !chatId) {
      alert('⚠️ يرجى التأكد من إضافة متغيرات NEXT_PUBLIC_TELEGRAM_BOT_TOKEN و CHAT_ID في Vercel');
      return;
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-YE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' });
    const medals = ['🥇', '🥈', '🥉', '🏅'];

    let winnersText = '';
    winnersList.forEach((w, index) => {
      const medal = winnersList.length > 1 ? (medals[index] || '🎉') : '🎉';
      winnersText += `${medal} *الفائز${winnersList.length > 1 ? ` (المركز ${index + 1})` : ''}:* ${w.customer_name}\n` +
                     `🏪 *عن طـريق المـوزع:* ${w.distributor_name || 'غير محدد'}\n\n`;
    });

    const message = 
`👑 *بطـاقـة الفـائز بالـسـحـب الأسبـوعـي* 👑
━━━━━━━━━━━━━━━━━━━━

${winnersText.trim()}

📅 *تـاريـخ السـحـب:* ${dateStr}
⏰ *تـوقـيـت الاعـتمـاد:* ${timeStr}

━━━━━━━━━━━━━━━━━━━━
📞 *للاستفسار واستلام الجائزة:*
يرجى التواصل مع إدارة الشبكة: 775878004
━━━━━━━━━━━━━━━━━━━━
✨ _تم السحب والاعتماد بنجاح عبر منصة تواصل_`;

    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown',
        }),
      });
      const result = await res.json();
      if (result.ok) {
        alert('✅ تم إرسال الرسالة إلى التلجرام بنجاح!');
      } else {
        alert('❌ فشل الإرسال: ' + result.description);
      }
    } catch (err) {
      console.error(err);
      alert('❌ حدث خطأ أثناء الاتصال بالتلجرام');
    }
  };

  const handleTestSingle = async () => {
    await sendToTelegram([
      { customer_name: "أحمد محسن (تجربة فائز)", distributor_name: "حساب التجربن" }
    ]);
  };

  const handleTestTriple = async () => {
    await sendToTelegram([
      { customer_name: "أحمد محسن (المركز الأول)", distributor_name: "حساب التجربن" },
      { customer_name: "محمد علي (المركز الثاني)", distributor_name: "موزع الأمل" },
      { customer_name: "صالح العنسي (المركز الثالث)", distributor_name: "موزع البركة" }
    ]);
  };

  return (
    <div className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head">
        <h3>لوحة إدارة السحب الأسبوعي</h3>
      </div>
      
      {winner ? (
        <div style={{ fontSize: 13, padding: '10px 0' }}>
          آخر فائز معتمد: <b>{winner.customer_name}</b> (الموزع: {winner.distributor_name || 'غير محدد'})
        </div>
      ) : (
        <div style={{ color: 'var(--ink-soft)', fontSize: 13, padding: '10px 0' }}>
          لا يوجد فائز معتمد حتى الآن.
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 15, paddingTop: 12, borderTop: '1px solid #F3F0FB' }}>
        <button 
          onClick={handleTestSingle} 
          style={{ padding: '7px 12px', background: '#F59E0B', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}
        >
          🧪 تجربة (فائز واحد)
        </button>
        <button 
          onClick={handleTestTriple} 
          style={{ padding: '7px 12px', background: '#10B981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}
        >
          🧪 تجربة (3 فائزين)
        </button>
      </div>
    </div>
  );
}
