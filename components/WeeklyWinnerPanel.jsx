'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function WeeklyWinnerPanel() {
  const [winner, setWinner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchCurrentWinner();
  }, []);

  // 1. جلب بيانات الفائز وتفقد جميع مسميات الأعمدة المحتملة
  async function fetchCurrentWinner() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('weekly_winners')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('خطأ Supabase عند جلب الفائز:', error);
      } else if (data && data.length > 0) {
        setWinner(data[0]);
      } else {
        setWinner(null);
      }
    } catch (err) {
      console.error('خطأ غير متوقع:', err);
    } finally {
      setLoading(false);
    }
  }

  // 2. دالة إرسال الإشعار إلى التليجرام
  const sendTelegramDirect = async (winnersList) => {
    setSending(true);

    const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.NEXT_PUBLIC_TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_ADMIN_CHAT_ID;

    if (!botToken || !chatId) {
      alert('⚠️ يرجى التأكد من إضافة متغيرات NEXT_PUBLIC_TELEGRAM_BOT_TOKEN و CHAT_ID في إعدادات Vercel');
      setSending(false);
      return;
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-YE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' });
    const medals = ['🥇', '🥈', '🥉', '🏅'];

    let winnersText = '';
    winnersList.forEach((w, index) => {
      const medal = winnersList.length > 1 ? (medals[index] || '🎉') : '🎉';
      const name = w.customer_name || w.winner_name || w.name || w.winnerName || 'غير محدد';
      const dist = w.distributor_name || w.distributor || w.distributorName || 'غير محدد';

      winnersText += `${medal} *الفائز${winnersList.length > 1 ? ` (المركز ${index + 1})` : ''}:* ${name}\n` +
                     `🏪 *عن طـريق المـوزع:* ${dist}\n\n`;
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

      const resData = await res.json();
      if (resData.ok) {
        alert('✅ تم إرسال الإشعار إلى التليجرام بنجاح!');
      } else {
        alert(`❌ فشل التليجرام: ${resData.description}`);
      }
    } catch (err) {
      alert(`❌ خطأ في الاتصال: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  // لاستخراج اسم الفائز مهما كان اسم العمود في Supabase
  const getWinnerName = () => {
    if (!winner) return '';
    return winner.customer_name || winner.winner_name || winner.name || winner.winnerName || winner.user_name || 'أحمد محسن';
  };

  // لاستخراج اسم الموزع مهما كان اسم العمود
  const getDistributorName = () => {
    if (!winner) return '';
    return winner.distributor_name || winner.distributor || winner.distributorName || 'غير محدد';
  };

  return (
    <div className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head">
        <h3>لوحة إدارة السحب الأسبوعي</h3>
      </div>
      
      {/* عرض بيانات الفائز */}
      {loading ? (
        <div style={{ fontSize: 13, padding: '10px 0', color: '#666' }}>جاري التحقق من الفائز...</div>
      ) : winner ? (
        <div style={{ fontSize: 13, padding: '10px 0', lineHeight: '1.6' }}>
          آخر فائز معتمد: <b>{getWinnerName()}</b>
          <br />
          الموزع: <span>{getDistributorName()}</span>
        </div>
      ) : (
        <div style={{ color: 'var(--ink-soft)', fontSize: 13, padding: '10px 0' }}>
          لا يوجد فائز معتمد حتى الآن.
        </div>
      )}

      {/* أزرار تجربة التليجرام */}
      <div style={{ display: 'flex', gap: 10, marginTop: 15, paddingTop: 12, borderTop: '1px solid #F3F0FB' }}>
        <button 
          disabled={sending}
          onClick={() => sendTelegramDirect([{ customer_name: getWinnerName() || "أحمد محسن", distributor_name: getDistributorName() }])} 
          style={{ padding: '8px 12px', background: '#F59E0B', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 'bold', opacity: sending ? 0.6 : 1 }}
        >
          {sending ? 'جاري الإرسال...' : '🧪 تجربة (فائز واحد)'}
        </button>
        <button 
          disabled={sending}
          onClick={() => sendTelegramDirect([
            { customer_name: getWinnerName() || "أحمد محسن (المركز الأول)", distributor_name: getDistributorName() },
            { customer_name: "محمد علي (المركز الثاني)", distributor_name: "موزع الأمل" },
            { customer_name: "صالح العنسي (المركز الثالث)", distributor_name: "موزع البركة" }
          ])} 
          style={{ padding: '8px 12px', background: '#10B981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 'bold', opacity: sending ? 0.6 : 1 }}
        >
          {sending ? 'جاري الإرسال...' : '🧪 تجربة (3 فائزين)'}
        </button>
      </div>
    </div>
  );
}
