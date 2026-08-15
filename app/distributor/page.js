'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '../../components/Sidebar';
import { AdSlotBar } from '../../components/AdSlot';
import { useProfile } from '../../lib/useProfile';
import { supabase } from '../../lib/supabase';

export default function DistributorPage() {
  const { profile, loading } = useProfile('distributor');
  const [myCards, setMyCards] = useState([]);
  const [soldToday, setSoldToday] = useState(0);
  const [revealedCard, setRevealedCard] = useState(null);
  const [revealError, setRevealError] = useState('');

  async function load() {
    if (!profile) return;
    const { data } = await supabase
      .from('cards')
      .select('*, packages(name)')
      .eq('assigned_to', profile.id)
      .eq('status', 'with_distributor');
    setMyCards(data || []);

    const since = new Date(); since.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('cards')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', profile.id)
      .eq('status', 'sold')
      .gte('sold_at', since.toISOString());
    setSoldToday(count || 0);
  }

  useEffect(() => { load(); }, [profile]);

  async function revealCard(pkgId, pkgName) {
    setRevealError('');
    const { data, error } = await supabase
      .from('cards')
      .select('id, code')
      .eq('assigned_to', profile.id)
      .eq('package_id', pkgId)
      .eq('status', 'with_distributor')
      .order('created_at', { ascending: true })
      .limit(1);

    if (error || !data || data.length === 0) {
      setRevealError('تعذّر إيجاد كرت متاح من هذه الباقة');
      return;
    }

    const cardId = data[0].id;
    const cardCode = data[0].code;

    // خصم الكرت وتسجيله كمبيع فور إظهاره
    await supabase.rpc('sell_card', { c_id: cardId });

    setRevealedCard({ id: cardId, code: cardCode, packageName: pkgName });
    load(); // تحديث القوائم والمبيعات فورياً خلف الكواليس
  }

  if (loading) return null;

  const byPackage = {};
  myCards.forEach((c) => {
    const key = c.packages?.name || 'غير محدد';
    if (!byPackage[key]) byPackage[key] = { count: 0, packageId: c.package_id };
    byPackage[key].count += 1;
  });

  return (
    <div className="app">
      <Sidebar role="distributor" active="/distributor" name={profile.full_name} />
      <div className="main">
        <div className="topbar">
          <div><h1>مرحبًا، {profile.full_name} 👋</h1><div className="greet">إليك ملخص حسابك اليوم</div></div>
        </div>

        <AdSlotBar />

        <div className="balance-card">
          <div className="lbl">رصيدك الحالي</div>
          <div className="amt">{Number(profile.balance).toLocaleString('en-US')} <span>ريال</span></div>
          <div className="foot">
            <div style={{ fontSize: 11.5, color: '#E3D6FF' }}>كروت لديك الآن: {myCards.length}</div>
            <Link href="/distributor/request"><button className="req-btn">طلب كروت جديد</button></Link>
          </div>
        </div>

        <div className="grid-stats" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
          <div className="stat"><div className="label">كروت متاحة عندي</div><div className="value">{myCards.length}</div></div>
          <div className="stat"><div className="label">مبيعات اليوم</div><div className="value">{soldToday}</div></div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>باقاتي المتاحة</h3>
            <span className="muted">اضغط "إظهار كرت" عند وجود زبون</span>
          </div>
          {revealError && <div className="error-note">{revealError}</div>}
          {Object.keys(byPackage).length === 0 && <div style={{ color: 'var(--ink-soft)', fontSize: 13 }}>لا توجد كروت لديك حاليًا</div>}
          <div className="pkg-grid">
            {Object.entries(byPackage).map(([name, info]) => (
              <div className="pkg-card" key={name}>
                <div className="pname">{name}</div>
                <div className="pcount">{info.count} <span>كرت لديك</span></div>
                <button
                  className="btn-primary"
                  style={{ marginTop: 14, width: '100%' }}
                  onClick={() => revealCard(info.packageId, name)}
                >
                  إظهار كرت
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {revealedCard && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 10, 30, 0.65)',
          backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
        }}>
          <div style={{
            background: '#ffffff', borderRadius: 28, padding: 32, maxWidth: 380, width: '100%',
            textAlign: 'center', position: 'relative', boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
            border: '1px solid rgba(139, 92, 246, 0.15)',
          }}>
            {/* زر الإغلاق العادي */}
            <button
              onClick={() => setRevealedCard(null)}
              style={{
                position: 'absolute', top: 16, left: 16, width: 36, height: 36, borderRadius: 12,
                border: 'none', background: '#FEF2F2', color: '#EF4444', fontSize: 16, fontWeight: 900, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
              }}
              title="إغلاق النافذة"
            >
              ✕
            </button>

            <div style={{ fontSize: 13, color: '#7C3AED', fontWeight: 800, marginBottom: 4, background: '#F3E8FF', display: 'inline-block', padding: '4px 12px', borderRadius: 20 }}>
              {revealedCard.packageName}
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#1F2937', margin: '8px 0 16px 0' }}>رمز الكرت المتاح</h3>

            {/* صندوق الكود */}
            <div 
              onClick={() => {
                navigator.clipboard.writeText(revealedCard.code);
                alert("تم نسخ رمز الكرت بنجاح!");
              }}
              style={{
                background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
                border: '2px dashed #C4B5FD',
                color: '#6D28D9',
                fontFamily: 'monospace',
                fontSize: 32,
                fontWeight: 900,
                padding: '16px 10px',
                borderRadius: 20,
                cursor: 'pointer',
                letterSpacing: '2px',
                marginBottom: 12,
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
                direction: 'ltr',
              }}
            >
              {revealedCard.code}
            </div>
            <div style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 20 }}>اضغط على الرقم للنسخ السريع</div>

            {/* الأزرار (واتساب ونسخ) */}
            <div style={{ display: 'flex', gap: 10 }}>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`مرحباً، إليك رمز كرت الإنترنت الخاص بك:\n${revealedCard.code}\nالباقة: ${revealedCard.packageName}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  background: '#22C55E',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: 14,
                  padding: '12px 16px',
                  borderRadius: 14,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow: '0 8px 20px rgba(34, 197, 94, 0.3)',
                }}
              >
                <span>إرسال واتساب</span>
              </a>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(revealedCard.code);
                  alert("تم النسخ بنجاح!");
                }}
                style={{
                  background: '#F3F4F6',
                  color: '#374151',
                  fontWeight: 800,
                  fontSize: 14,
                  padding: '12px 18px',
                  borderRadius: 14,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                نسخ
              </button>
            </div>

            <div style={{ fontSize: 11, color: '#22C55E', fontWeight: 700, marginTop: 16 }}>
              ✓ تم تسجيل بيع الكرت واحتسابه تلقائياً.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
