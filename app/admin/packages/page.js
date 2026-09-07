'use client';
import { useEffect, useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

export default function PackagesPage() {
  const { profile, loading } = useProfile('admin');
  const [packages, setPackages] = useState([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  async function loadPackages() {
    // جلب الباقات مع حساب عدد الكروت المرتبطة بكل باقة
    const { data, error: fetchError } = await supabase
      .from('packages')
      .select('*, cards(id)')
      .order('created_at', { ascending: false });

    if (!fetchError && data) {
      const formatted = data.map((pkg) => ({
        ...pkg,
        cardsCount: pkg.cards ? pkg.cards.length : 0
      }));
      setPackages(formatted);
    } else {
      setPackages([]);
    }
  }

  useEffect(() => {
    if (profile) loadPackages();
  }, [profile]);

  async function addPackage(e) {
    e.preventDefault();
    setError('');
    if (!name || !price) return;

    const { error: insertError } = await supabase
      .from('packages')
      .insert({
        name,
        price: parseFloat(price)
      });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setName('');
    setPrice('');
    loadPackages();
  }

  async function deletePackage(id, name) {
    if (
      !window.confirm(
        `سيتم حذف باقة "${name}" نهائيًا. لا يمكن حذف باقة مرتبطة بكروت موجودة حاليًا. متابعة؟`
      )
    ) {
      return;
    }

    setError('');
    setBusyId(id);

    const { error: deleteError } = await supabase
      .from('packages')
      .delete()
      .eq('id', id);

    setBusyId(null);

    if (deleteError) {
      setError(
        'تعذّر حذف الباقة — على الأغلب توجد كروت أو طلبات مرتبطة بها حاليًا'
      );
      return;
    }

    loadPackages();
  }

  if (loading) return null;

  return (
    <div className="app">
      <Sidebar
        role="admin"
        active="/admin/packages"
        name={profile.full_name}
      />

      <div className="main">
        <h1>الباقات</h1>

        <p className="greet" style={{ marginBottom: 20 }}>
          إدارة باقات الكروت وأسعارها
        </p>

        <div className="panel">
          <div className="panel-head">
            <h3>إضافة باقة جديدة</h3>
          </div>

          {error && <div className="error-note">{error}</div>}

          <form
            onSubmit={addPackage}
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'flex-end'
            }}
          >
            <div
              className="field"
              style={{
                marginBottom: 0,
                flex: 1,
                minWidth: 180
              }}
            >
              <label>اسم الباقة</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: باقة 20GB"
              />
            </div>

            <div
              className="field"
              style={{
                marginBottom: 0,
                width: 140
              }}
            >
              <label>السعر (لكل كرت)</label>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="25"
              />
            </div>

            <button
              className="btn-primary"
              style={{ width: 140 }}
              type="submit"
            >
              إضافة
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>الباقات الحالية</h3>
            <span className="muted">{packages.length}</span>
          </div>

          {/* الباقات بشكل مستطيلات أفقية */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 14,
              marginTop: 10
            }}
          >
            {packages.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  minHeight: 82,
                  padding: '14px 18px',
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  boxSizing: 'border-box'
                }}
              >
                {/* اسم الباقة */}
                <div
                  style={{
                    minWidth: 0,
                    flex: 1
                  }}
                >
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: '#111827',
                      marginBottom: 6,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {p.name}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      flexWrap: 'wrap',
                      fontSize: 14
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        color: '#374151'
                      }}
                    >
                      {p.price} ريال
                    </span>

                    <span
                      style={{
                        fontWeight: 800,
                        color: '#5B21B6'
                      }}
                    >
                      {p.cardsCount} كرت
                    </span>
                  </div>
                </div>

                {/* زر الحذف */}
                <button
                  className="btn-sm"
                  style={{
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    opacity: 1,
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    flexShrink: 0
                  }}
                  disabled={busyId === p.id}
                  onClick={() => deletePackage(p.id, p.name)}
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
