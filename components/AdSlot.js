// خانة الإعلانات - لصقها هنا لاحقًا يكفي لتفعيلها في كل الموقع
// عند ربط شبكة إعلانات حقيقية (مثل AdSense)، استبدل محتوى <div id="ad-slot">
// بكود الإعلان الذي تحصل عليه من الشبكة. تعمل تلقائيًا 24 ساعة بدون أي تدخل يدوي.

export function AdSlotAdmin() {
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>المساحة الإعلانية</h3>
        <span className="muted">خاصة بالمدير فقط — غير مرئية للموزعين</span>
      </div>
      <div id="ad-slot-admin" style={{
        border: '1.5px dashed var(--line)', borderRadius: 16, padding: 26,
        textAlign: 'center', background: 'var(--surface-2)',
      }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>🎬 مساحة فيديو إعلاني</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', maxWidth: 420, margin: '0 auto 16px', lineHeight: 1.9 }}>
          مكان مخصص لربط إعلان فيديو (مثل Google AdSense) لتحقيق دخل إضافي. يظهر في لوحتك أنت فقط.
        </div>
        <button className="btn-sm" style={{ background: 'var(--grad-cta)', color: '#fff', padding: '10px 20px' }}>
          ربط حساب إعلانات
        </button>
      </div>
    </div>
  );
}

export function AdSlotBar() {
  return (
    <div className="panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>📺</span>
        <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600 }}>
          مساحة إعلانية — محتوى ثابت لا يوقف عملك
        </span>
      </div>
      <div id="ad-slot-distributor" />
    </div>
  );
}
