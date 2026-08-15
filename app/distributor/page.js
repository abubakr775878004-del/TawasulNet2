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
  const [revealBusy, setRevealBusy] = useState(false);
  const [revealError, setRevealError] = useState('');
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [copied, setCopied] = useState(false);

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
    setRevealedCard({ id: data[0].id, code: data[0].code, packageName: pkgName });
    setConfirmingClose(false);
    setCopied(false);
  }

  function closeModal() {
    setRevealedCard(null);
    setConfirmingClose(false);
    setCopied(false);
  }

  async function copyCode() {
    if (!revealedCard) return;
    try {
      await navigator.clipboard.writeText(revealedCard.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // تجاهل الخطأ إذا فشل النسخ
    }
  }

  function shareWhatsapp() {
    if (!revealedCard) return;
    const text = `كود الكرت: ${revealedCard.code} — ${revealedCard.packageName}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  async function finalizeSold() {
    if (!revealedCard) return;
    setRevealBusy(true);
    await supabase.rpc('sell_card', { c_id: revealedCard.id });
    setRevealBusy(false);
    closeModal();
    load();
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
          position: 'fixed', inset: 0, background: 'rgba(20,10,40,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
        }}>
          <div style={{
            background: 'linear-gradient(160deg, #ffffff 0%, #ffffff 60%, #F3F0FB 100%)',
            borderRadius: 24, padding: 0, maxWidth: 380, width: '100%',
            textAlign: 'center', position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
            overflow: 'hidden',
          }}>
            {/* شريط علوي ملوّن بألوان الهوية */}
            <div style={{
              background: 'linear-gradient(120deg, #5B21B6, #7C3AED, #DB2777)',
              padding: '18px 20px', position: 'relative',
            }}>
              <button
                onClick={closeModal}
                disabled={revealBusy}
                style={{
                  position: 'absolute', top: 12, left: 12, width: 30, height: 30, borderRadius: 10,
                  border: 'none', background: 'rgba(255,255,255,0.25)', color: '#fff', fontSize: 15, fontWeight: 900, cursor: 'pointer',
                }}
                title="إغلاق"
              >
                ✕
              </button>
              <div style={{ fontSize: 12.5, color: '#E3D6FF', fontWeight: 700 }}>{revealedCard.packageName}</div>
              <div style={{ fontSize: 12, color: '#fff', fontWeight: 900, marginTop: 2 }}>تواصل — كرت جاهز للتسليم</div>
            </div>

            <div style={{ padding: 26 }}>
              {!confirmingClose && (
                <>
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
                    onClick={() => setConfirmingClose(true)}
                    style={{
                      width: '100%', padding: '13px 0', borderRadius: 14, border: 'none',
                      background: 'linear-gradient(120deg, #7C3AED, #DB2777)', color: '#fff',
                      fontWeight: 800, fontSize: 13.5, cursor: 'pointer',
                    }}
                  >
                    تم تسليم الكرت للزبون
                  </button>
                </>
              )}

              {confirmingClose && (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#3A1D66', marginBottom: 4 }}>
                    هل تأكدت أنك أعطيت الكرت للزبون؟
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 18 }}>
                    بعد التأكيد سيُسجَّل الكرت كمباع ولا يمكن التراجع
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => setConfirmingClose(false)}
                      disabled={revealBusy}
                      style={{
                        flex: 1, padding: '12px 0', borderRadius: 12, border: '1.5px solid var(--line)',
                        background: '#fff', color: 'var(--ink-soft)', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                      }}
                    >
                      لا، رجوع
                    </button>
                    <button
                      onClick={finalizeSold}
                      disabled={revealBusy}
                      style={{
                        flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
                        background: '#10B981', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                      }}
                    >
                      {revealBusy ? '...' : 'نعم، تم البيع'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
