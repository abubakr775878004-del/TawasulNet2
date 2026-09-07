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
"سيتم حذف باقة "${name}" نهائيًا. لا يمكن حذف باقة مرتبطة بكروت موجودة حاليًا. متابعة؟"
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

    {/* إضافة باقة */}
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
          style={{
            width: 140,
            height: 42
          }}
          type="submit"
        >
          إضافة
        </button>
      </form>
    </div>

    {/* الباقات الحالية */}
    <div className="panel">
      <div className="panel-head">
        <h3>الباقات الحالية</h3>

        <span className="muted">
          {packages.length}
        </span>
      </div>

      {/* بطاقات الباقات */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(330px, 400px))',
          gap: 16,
          marginTop: 18,
          justifyContent: 'start',
          alignItems: 'stretch'
        }}
      >
        {packages.map((p) => (
          <div
            key={p.id}
            style={{
              width: '100%',
              minHeight: 150,
              boxSizing: 'border-box',
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              boxShadow: '0 3px 10px rgba(0, 0, 0, 0.05)',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              overflow: 'hidden'
            }}
          >
            {/* رأس البطاقة */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                paddingBottom: 12,
                borderBottom: '1px solid #f1f5f9'
              }}
            >
              <div
                style={{
                  minWidth: 0,
                  flex: 1
                }}
              >
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 800,
                    color: '#111827',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {p.name}
                </div>

                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    color: '#9ca3af'
                  }}
                >
                  اسم الباقة
                </div>
              </div>

              {/* السعر */}
              <div
                style={{
                  flexShrink: 0,
                  textAlign: 'left',
                  paddingRight: 8
                }}
              >
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 800,
                    color: '#374151',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {p.price} ريال
                </div>

                <div
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    color: '#9ca3af',
                    whiteSpace: 'nowrap'
                  }}
                >
                  سعر الكرت
                </div>
              </div>
            </div>

            {/* معلومات البطاقة */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                paddingTop: 13
              }}
            >
              {/* عدد الكروت */}
              <div
                style={{
                  minWidth: 0
                }}
              >
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: '#5B21B6',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {p.cardsCount} كرت
                </div>

                <div
                  style={{
                    marginTop: 3,
                    fontSize: 11,
                    color: '#9ca3af'
                  }}
                >
                  الكروت المرتبطة
                </div>
              </div>

              {/* تاريخ الإنشاء */}
              <div
                style={{
                  minWidth: 0,
                  textAlign: 'left'
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#6b7280',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {new Date(p.created_at).toLocaleDateString('ar')}
                </div>

                <div
                  style={{
                    marginTop: 3,
                    fontSize: 11,
                    color: '#9ca3af'
                  }}
                >
                  تاريخ الإنشاء
                </div>
              </div>

              {/* زر الحذف */}
              <button
                className="btn-sm"
                style={{
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  opacity: 1,
                  padding: '7px 14px',
                  borderRadius: 7,
                  border: 'none',
                  flexShrink: 0,
                  cursor:
                    busyId === p.id
                      ? 'not-allowed'
                      : 'pointer',
                  whiteSpace: 'nowrap'
                }}
                disabled={busyId === p.id}
                onClick={() => deletePackage(p.id, p.name)}
              >
                {busyId === p.id
                  ? 'جاري الحذف...'
                  : 'حذف'}
              </button>
            </div>
          </div>
        ))}

        {packages.length === 0 && (
          <div
            style={{
              gridColumn: '1 / -1',
              padding: '40px 20px',
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: 14
            }}
          >
            لا توجد باقات حاليًا
          </div>
        )}
      </div>

      {/* مساحة مخصصة لنظام MikroTik لاحقًا */}
      <div
        style={{
          marginTop: 55,
          minHeight: 260,
          borderTop: '1px solid #f1f5f9',
          paddingTop: 30
        }}
      >
        {/* نظام MikroTik سيضاف هنا لاحقًا */}
      </div>
    </div>
  </div>
</div>

);
}
