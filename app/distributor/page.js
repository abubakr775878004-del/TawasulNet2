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

  const [pendingPackage, setPendingPackage] = useState(null);
  const [revealedCard, setRevealedCard] = useState(null);
  const [revealBusy, setRevealBusy] = useState(false);
  const [revealError, setRevealError] = useState('');
  const [copied, setCopied] = useState(false);
  
  // حالة خاصة لنسخ الكرت الشخصي
  const [personalCopied, setPersonalCopied] = useState(false);

  async function load() {
    if (!profile) return;
    const { data } = await supabase
      .from('cards')
      .select('*, packages(name, price)')
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

  function askReveal(pkgId, pkgName) {
    setRevealError('');
    setPendingPackage({ id: pkgId, name: pkgName });
  }

  function cancelReveal() {
    setPendingPackage(null);
  }

  async function confirmReveal() {
    if (!pendingPackage) return;
    setRevealBusy(true);

    const { data, error } = await supabase
      .from('cards')
      .select('id, code')
      .eq('assigned_to', profile.id)
      .eq('package_id', pendingPackage.id)
      .eq('status', 'with_distributor')
      .order('created_at', { ascending: true })
      .limit(1);

    if (error || !data || data.length === 0) {
      setRevealBusy(false);
      setRevealError('تعذّر إيجاد كرت متاح من هذه الباقة');
      setPendingPackage(null);
      return;
    }

    const card = data[0];
    await supabase.rpc('sell_card', { c_id: card.id });

    setRevealBusy(false);
    setRevealedCard({ code: card.code, packageName: pendingPackage.name });
    setPendingPackage(null);
    setCopied(false);
    load();
  }

  function closeModal() {
    setRevealedCard(null);
    setCopied(false);
  }

  async function copyCode() {
    if (!revealedCard) return;
    try {
      await navigator.clipboard.writeText(revealedCard.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  }

  async function copyPersonalCode(codeText) {
    try {
      await navigator.clipboard.writeText(codeText);
      setPersonalCopied(true);
      setTimeout(() => setPersonalCopied(false), 2000);
    } catch (e) {}
  }

  function shareWhatsapp() {
    if (!revealedCard) return;
    const text = `كود الكرت: ${revealedCard.code} — ${revealedCard.packageName}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  if (loading) return null;

  const byPackage = {};
  myCards.forEach((c) => {
    const key = c.packages?.name || 'غير محدد';
    if (!byPackage[key]) {
      byPackage[key] = { count: 0, packageId: c.package_id, price: c.packages?.price || 0 };
    }
    byPackage[key].count += 1;
  });

  const totalValue = Object.values(byPackage).reduce((sum, p) => sum + p.count * p.price, 0);

  return (
    <div className="app">
      <Sidebar role="distributor" active="/distributor" name={profile.full_name} />
      <div className="main">
        <div className="topbar">
          <div><h1>مرحبًا، {profile.full_name} 👋</h1><div className="greet">إليك ملخص حسابك اليوم</div></div>
        </div>

        <AdSlotBar />

        {/* خانة الكرت الشخصي الثابت للموزع (يتم تعديلها من لوحة المدير وتظهر هنا دائماً) */}
        {profile.personal_card && (
          <div style={{
            background: 'linear-gradient(135deg, #5B21B6 0%, #7C3AED 50%, #DB2777 100%)',
            borderRadius: 20, padding: '20px 24px', color: '#fff', marginBottom: 20,
            boxShadow: '0 10px 25px rgba(124, 58, 237, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 15
          }}>
            <div>
              <div style={{ fontSize: 12, color: '#E3D6FF', fontWeight: 700, marginBottom: 4 }}>⭐ كرتك الشخصي (ثابت ومميز)</div>
              <div className="mono" style={{ fontSize: 24, fontWeight: 900, letterSpacing: 1.5 }}>
                {profile.personal_card}
              </div>
            </div>
            <button
              onClick={() => copyPersonalCode(profile.personal_card)}
              style={{
                background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)',
                color: '#fff', padding: '10px 18px', borderRadius: 12, fontWeight: 800, fontSize: 13, cursor: 'pointer',
              }}
            >
              {personalCopied ? '✓ تم النسخ' : '📋 نسخ الكرت الشخصي'}
            </button>
          </div>
        )}

        <div className="balance-card">
          <div className="lbl">رصيدك الحالي</div>
          <div className="amt">{Number(profile.balance).toLocaleString('en-US')} <span>ريال</span></div>
          <div className="foot">
            <div style={{ fontSize: 11.5, color: '#E3D6FF' }}>كروت لديك الآن: {myCards.length}</div>
            <Link href="/distributor/request"><button className="req-btn">طلب كروت جديد</button></Link>
          </div>
        </div>

        <div className="grid-stats" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          <div className="stat"><div className="label">كروت متاحة عندي</div><div className="value">{myCards.length}</div></div>
          <div className="stat"><div className="label">مبيعات اليوم</div><div className="value">{soldToday}</div></div>
          <div className="stat">
            <div className="label">القيمة الإجمالية لكروتك</div>
            <div className="value" style={{ fontSize: 20 }}>{totalValue.toLocaleString('en-US')} <span style={{ fontSize: 12, fontWeight: 700 }}>ريال</span></div>
          </div>
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
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', fontWeight: 700, marginTop: 4 }}>
                  القيمة: {(info.count * info.price).toLocaleString('en-US')} ريال
                </div>
                <button
                  className="btn-primary"
                  style={{ marginTop: 14, width: '100%' }}
                  onClick={() => askReveal(info.packageId, name)}
                >
                  إظهار كرت
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* نافذة تأكيد إظهار الكرت */}
      {pendingPackage && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(20,10,40,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
        }}>
          <div style={{
            background: '#fff', borderRadius: 22, padding: 0, maxWidth: 340, width: '100%',
            textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.35)', overflow: 'hidden',
          }}>
            <div style={{
              background: 'linear-gradient(120deg, #5B21B6, #7C3AED, #DB2777)',
              padding: '26px 20px 22px',
            }}>
              <div style={{ fontSize: 12, color: '#E3D6FF', fontWeight: 700, marginBottom: 6 }}>
                إظهار كرت من باقة
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>
                {pendingPackage.name}
              </div>
            </div>

            <div style={{ padding: '20px 24px 24px' }}>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 20 }}>
                سيتم تسليم كرت واحد وتسجيله كمباع مباشرة
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={cancelReveal}
                  disabled={revealBusy}
                  style={{
                    flex: 1, padding: '13px 0', borderRadius: 12, border: '1.5px solid var(--line)',
                    background: '#fff', color: 'var(--ink-soft)', fontWeight: 800, fontSize: 13.5, cursor: 'pointer',
                  }}
                >
                  لا
                </button>
                <button
                  onClick={confirmReveal}
                  disabled={revealBusy}
                  style={{
                    flex: 1, padding: '13px 0', borderRadius: 12, border: 'none',
                    background: 'linear-gradient(120deg, #7C3AED, #DB2777)', color: '#fff',
                    fontWeight: 800, fontSize: 13.5, cursor: 'pointer',
                  }}
                >
                  {revealBusy ? '...' : 'نعم'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نافذة عرض الكرت بعد البيع */}
      {revealedCard && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(20,10,40,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
        }}>
          <div style={{
            background: 'linear-gradient(160deg, #ffffff 0%, #ffffff 60%, #F3F0FB 100%)',
            borderRadius: 24, padding: 0, maxWidth: 380, width: '100%',
            textAlign: 'center', position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
            overflow: 'hidden',
          }}>
            <div style={{
              background: 'linear-gradient(120deg, #5B21B6, #7C3AED, #DB2777)',
              padding: '18px 20px', position: 'relative',
            }}>
              <button
                onClick={closeModal}
                style={{
                  position: 'absolute', top: 12, left: 12, width: 30, height: 30, borderRadius: 10,
                  border: 'none', background: 'rgba(255,255,255,0.25)', color: '#fff', fontSize: 15, fontWeight: 900, cursor: 'pointer',
                }}
                title="إغلاق"
              >
                ✕
              </button>
              <div style={{ fontSize: 12.5, color: '#E3D6FF', fontWeight: 700 }}>{revealedCard.packageName}</div>
              <div style={{ fontSize: 12, color: '#fff', fontWeight: 900, marginTop: 2 }}>✓ تم البيع بنجاح</div>
            </div>

            <div style={{ padding: 26 }}>
              <div className="mono" style={{
                fontSize: 28, fontWeight: 900, margin: '4px 0 18px', letterSpacing: 1, direction: 'ltr',
                color: '#3A1D66',
              }}>
                {revealedCard.code}
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                <button
                  onClick={copyCode}
                  style={{
                    flex: 1, padding: '11px 0', borderRadius: 12, border: '1.5px solid #DDD3F5',
                    background: '#F3F0FB', color: '#5B21B6', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  {copied ? '✓ تم النسخ' : '📋 نسخ الكود'}
                </button>
                <button
                  onClick={shareWhatsapp}
                  style={{
                    flex: 1, padding: '11px 0', borderRadius: 12, border: 'none',
                    background: '#25D366', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  واتساب
                </button>
              </div>

              <button
                onClick={closeModal}
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 14, border: 'none',
                  background: '#F3F0FB', color: '#5B21B6', fontWeight: 800, fontSize: 13.5, cursor: 'pointer',
                }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
