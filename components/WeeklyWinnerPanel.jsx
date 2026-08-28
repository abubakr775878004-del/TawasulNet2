'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// دالة التلجرام المدمجة مباشرة لمنع خطأ Module not found
async function sendWinnersToTelegram(winnersList, adminPhone = '775878004') {
  if (typeof window === 'undefined') return;

  const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.NEXT_PUBLIC_TELEGRAM_ADMIN_CHAT_ID;

  if (!botToken || !chatId || !winnersList || winnersList.length === 0) return;

  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-YE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' });

  const medals = ['🥇', '🥈', '🥉', '🏅'];

  let winnersText = '';
  winnersList.forEach((w, index) => {
    const medal = winnersList.length > 1 ? (medals[index] || '🎉') : '🎉';
    const winnerName = w.customer_name || w.winnerName || 'غير محدد';
    const distName = w.distributor_name || w.distributorName || 'غير محدد';

    winnersText += `${medal} *الفائز${winnersList.length > 1 ? ` (المركز ${index + 1})` : ''}:* ${winnerName}\n` +
                   `🏪 *عن طـريق المـوزع:* ${distName}\n\n`;
  });

  const message = 
`👑 *بطـاقـة الفـائز بالـسـحـب الأسبـوعـي* 👑
━━━━━━━━━━━━━━━━━━━━

${winnersText.trim()}

📅 *تـاريـخ السـحـب:* ${dateStr}
⏰ *تـوقـيـت الاعـتمـاد:* ${timeStr}

━━━━━━━━━━━━━━━━━━━━
📞 *للاستفسار واستلام الجائزة:*
يرجى التواصل مع إدارة الشبكة: ${adminPhone}
━━━━━━━━━━━━━━━━━━━━
✨ _تم السحب والاعتماد بنجاح عبر منصة تواصل_`;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });
  } catch (err) {
    console.error('Failed to send Telegram winner alert:', err);
  }
}

export default function WeeklyWinnerPanel() {
  const [winner, setWinner] = useState(null);

  useEffect(() => {
    async function loadWinner() {
      const { data } = await supabase.rpc('get_weekly_winner');
      if (data) setWinner(data);
    }
    loadWinner();
  }, []);

  // 🧪 زر تجربة إرسال فائز واحد
  const handleTestSingle = async () => {
    await sendWinnersToTelegram([
      { customer_name: "أحمد محسن (تجربة)", distributor_name: "حساب التجربن" }
    ]);
    alert('✅ تم إرسال إشعار تجربة فائز واحد إلى التلجرام!');
  };

  // 🧪 زر تجربة إرسال 3 فائزين
  const handleTestTriple = async () => {
    await sendWinnersToTelegram([
      { customer_name: "أحمد محسن (المركز الأول)", distributor_name: "حساب التجربن" },
      { customer_name: "محمد علي (المركز الثاني)", distributor_name: "موزع الأمل" },
      { customer_name: "صالح العنسي (المركز الثالث)", distributor_name: "موزع البركة" }
    ]);
    alert('✅ تم إرسال إشعار تجربة 3 فائزين إلى التلجرام!');
  };

  return (
    <div className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head">
        <h3>🏆 مسابقة السحب الأسبوعي (لوحة التحكم)</h3>
      </div>
      
      {winner ? (
        <div style={{ padding: '10px 0', fontSize: 14 }}>
          الفائز الحالي: <strong>{winner.customer_name}</strong> (الموزع: {winner.distributor_name})
        </div>
      ) : (
        <div style={{ color: 'var(--ink-soft)', fontSize: 13, padding: '10px 0' }}>
          لا يوجد فائز معتمد حالياً.
        </div>
      )}

      {/* أزرار الفحص والتجربة المباشرة للتلجرام */}
      <div style={{ display: 'flex', gap: 10, marginTop: 15, paddingTop: 10, borderTop: '1px solid #eee' }}>
        <button onClick={handleTestSingle} style={{ padding: '6px 12px', background: '#F59E0B', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>
          🧪 تجربة إرسال (فائز واحد)
        </button>
        <button onClick={handleTestTriple} style={{ padding: '6px 12px', background: '#10B981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>
          🧪 تجربة إرسال (3 فائزين)
        </button>
      </div>
    </div>
  );
}
