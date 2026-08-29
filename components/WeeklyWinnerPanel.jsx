  // دالة إرسال الإشعار أو رسالة تجريبية للتأكد من عمل البوت
  async function handleSendNotificationOnly() {
    setLoading(true);
    setMessage('');

    try {
      // نص تجريبي للتأكد من وصول الإشعارات إلى بوت تيليجرام
      const text = winners.length > 0 
        ? `🎉🏆 نتائج السحب الأسبوعي - تواصل\n\n🥇 المركز الأول: ${winners[0]?.customer_name}\n🥈 المركز الثاني: ${winners[1]?.customer_name}\n🥉 المركز الثالث: ${winners[2]?.customer_name}`
        : `🧪 رسالة تجريبية من لوحة تحكم تواصل: نظام إشعارات تيليجرام يعمل بنجاح تام! ✅`;

      // إرسال إلى بوت التليجرام
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();

      if (data.success) {
        // فتح الواتساب أيضاً إذا أردت
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        setMessage('✓ تم إرسال الإشعار التجريبي بنجاح!');
      } else {
        setMessage(`❌ فشل الإرسال: ${data.error || 'خطأ غير معروف'}`);
      }
    } catch (err) {
      console.error(err);
      setMessage('❌ حدث خطأ أثناء الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }
