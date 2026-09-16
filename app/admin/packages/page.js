'use client';

import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

const LOW_STOCK_THRESHOLD = 10;

function PackageIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m21 8-9-5-9 5 9 5 9-5Z" />
      <path d="m3 8 9 5 9-5" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h3" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function StatCard({ icon, title, value, accent }) {
  return (
    <div
      style={{
        background: '#fafbfc',
        border: '1px solid #dfe3e8',
        borderRadius: 14,
        padding: '16px 17px',
        minWidth: 0,
        boxShadow: '0 3px 12px rgba(38, 50, 56, 0.035)'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 11,
            background: accent.background,
            color: accent.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          {icon}
        </div>

        <div
          style={{
            minWidth: 0,
            flex: 1,
            textAlign: 'right'
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: '#78909c',
              marginBottom: 5,
              fontWeight: 600
            }}
          >
            {title}
          </div>

          <div
            style={{
              fontSize: 23,
              lineHeight: 1,
              fontWeight: 900,
              color: '#263238'
            }}
          >
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PackagesPage() {
  const { profile, loading } = useProfile('admin');

  const [packages, setPackages] = useState([]);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');

  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [addingPackage, setAddingPackage] = useState(false);

  const [packageStats, setPackageStats] = useState({});
  const [packagesLoading, setPackagesLoading] = useState(true);

  async function loadPackages() {
    setPackagesLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('packages')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError || !data) {
      setPackages([]);
      setPackageStats({});
      setPackagesLoading(false);
      setError('تعذّر تحميل الباقات');
      return;
    }

    setPackages(data);

    const statsEntries = await Promise.all(
      data.map(async (pkg) => {
        const [
          totalResult,
          availableResult,
          distributorResult,
          soldResult
        ] = await Promise.all([
          supabase
            .from('cards')
            .select('id', { count: 'exact', head: true })
            .eq('package_id', pkg.id),

          supabase
            .from('cards')
            .select('id', { count: 'exact', head: true })
            .eq('package_id', pkg.id)
            .eq('status', 'available'),

          supabase
            .from('cards')
            .select('id', { count: 'exact', head: true })
            .eq('package_id', pkg.id)
            .eq('status', 'with_distributor'),

          supabase
            .from('cards')
            .select('id', { count: 'exact', head: true })
            .eq('package_id', pkg.id)
            .eq('status', 'sold')
        ]);

        return [
          pkg.id,
          {
            total: totalResult.count || 0,
            available: availableResult.count || 0,
            withDistributor: distributorResult.count || 0,
            sold: soldResult.count || 0
          }
        ];
      })
    );

    setPackageStats(Object.fromEntries(statsEntries));
    setPackagesLoading(false);
  }

  useEffect(() => {
    if (profile) {
      loadPackages();
    }
  }, [profile]);

  async function addPackage(e) {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    const numericPrice = parseFloat(price);

    if (!trimmedName || !price) {
      setError('يرجى إدخال اسم الباقة والسعر');
      return;
    }

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setError('السعر يجب أن يكون رقمًا أكبر من صفر');
      return;
    }

    setAddingPackage(true);

    const { error: insertError } = await supabase
      .from('packages')
      .insert({
        name: trimmedName,
        price: numericPrice
      });

    setAddingPackage(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setName('');
    setPrice('');

    await loadPackages();
  }

  async function deletePackage(id, packageName) {
    if (
      !window.confirm(
        `سيتم حذف باقة "${packageName}" نهائيًا.\n\nلا يمكن حذف باقة مرتبطة بكروت موجودة حاليًا.\n\nهل تريد المتابعة؟`
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
        'تعذّر حذف الباقة — على الأغلب توجد كروت أو بيانات مرتبطة بها حاليًا.'
      );
      return;
    }

    await loadPackages();
  }

  const totalAvailable = useMemo(
    () =>
      Object.values(packageStats).reduce(
        (sum, stats) => sum + (stats.available || 0),
        0
      ),
    [packageStats]
  );

  const totalWithDistributor = useMemo(
    () =>
      Object.values(packageStats).reduce(
        (sum, stats) => sum + (stats.withDistributor || 0),
        0
      ),
    [packageStats]
  );

  const totalSold = useMemo(
    () =>
      Object.values(packageStats).reduce(
        (sum, stats) => sum + (stats.sold || 0),
        0
      ),
    [packageStats]
  );

  const totalCards = useMemo(
    () =>
      Object.values(packageStats).reduce(
        (sum, stats) => sum + (stats.total || 0),
        0
      ),
    [packageStats]
  );

  const lowStockPackages = useMemo(
    () =>
      packages.filter((pkg) => {
        const stats = packageStats[pkg.id];
        const available = stats?.available || 0;

        return available <= LOW_STOCK_THRESHOLD;
      }),
    [packages, packageStats]
  );

  const outOfStockPackages = useMemo(
    () =>
      lowStockPackages.filter((pkg) => {
        const stats = packageStats[pkg.id];

        return (stats?.available || 0) === 0;
      }),
    [lowStockPackages, packageStats]
  );

  if (loading) return null;

  return (
    <div
      className="app"
      style={{
        background: '#f1f3f5',
        minHeight: '100vh'
      }}
    >
      <Sidebar
        role="admin"
        active="/admin/packages"
        name={profile?.full_name}
      />

      <div
        className="main"
        style={{
          paddingBottom: 40
        }}
      >
        {/* رأس الصفحة */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 20,
            marginBottom: 22,
            flexWrap: 'wrap'
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                marginBottom: 7
              }}
            >
              <div
                style={{
                  width: 43,
                  height: 43,
                  borderRadius: 12,
                  background:
                    'linear-gradient(135deg, #607f9e, #6f8faa)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow:
                    '0 5px 14px rgba(96, 127, 158, 0.14)'
                }}
              >
                <PackageIcon />
              </div>

              <div>
                <h1
                  style={{
                    margin: 0,
                    color: '#263238',
                    fontSize: 25,
                    fontWeight: 900,
                    letterSpacing: '-0.3px'
                  }}
                >
                  إدارة الباقات
                </h1>

                <p
                  style={{
                    margin: '5px 0 0',
                    color: '#78909c',
                    fontSize: 13.5
                  }}
                >
                  إدارة أسماء الباقات وأسعارها ومتابعة حالة مخزون كل باقة
                </p>
              </div>
            </div>
          </div>

          <div
            style={{
              background: '#fafbfc',
              border: '1px solid #dfe3e8',
              borderRadius: 12,
              padding: '9px 13px',
              color: '#54636b',
              fontSize: 13,
              fontWeight: 700,
              boxShadow:
                '0 3px 10px rgba(38, 50, 56, 0.03)'
            }}
          >
            {packages.length} باقة
          </div>
        </div>

        {error && (
          <div
            style={{
              marginBottom: 18,
              padding: '12px 14px',
              borderRadius: 11,
              background: '#f9eeee',
              color: '#a65f5f',
              border: '1px solid #e7caca',
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: 'pre-line'
            }}
          >
            {error}
          </div>
        )}

        {/* تنبيه المخزون المنخفض */}
        {!packagesLoading && lowStockPackages.length > 0 && (
          <div
            style={{
              marginBottom: 18,
              padding: '14px 15px',
              borderRadius: 13,
              background:
                outOfStockPackages.length > 0
                  ? '#faf3ea'
                  : '#faf5e9',
              border:
                outOfStockPackages.length > 0
                  ? '1px solid #e5d1b6'
                  : '1px solid #e5d6b5',
              boxShadow:
                '0 3px 12px rgba(38, 50, 56, 0.035)'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 11
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background:
                    outOfStockPackages.length > 0
                      ? '#f5e5d2'
                      : '#f3ead6',
                  color:
                    outOfStockPackages.length > 0
                      ? '#b07d48'
                      : '#a5874f',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <WarningIcon />
              </div>

              <div
                style={{
                  minWidth: 0,
                  flex: 1
                }}
              >
                <div
                  style={{
                    color:
                      outOfStockPackages.length > 0
                        ? '#98683d'
                        : '#8d7445',
                    fontSize: 14,
                    fontWeight: 900,
                    marginBottom: 5
                  }}
                >
                  {outOfStockPackages.length > 0
                    ? 'تنبيه: توجد باقات نفد مخزونها أو مخزونها منخفض'
                    : 'تنبيه: توجد باقات منخفضة المخزون'}
                </div>

                <div
                  style={{
                    color:
                      outOfStockPackages.length > 0
                        ? '#a87345'
                        : '#9a7b45',
                    fontSize: 12.5,
                    lineHeight: 1.7
                  }}
                >
                  يوجد {lowStockPackages.length} باقة تحتاج إلى متابعة.
                  يتم احتساب المخزون من الكروت المتاحة فقط، وحد التنبيه هو{' '}
                  <strong>{LOW_STOCK_THRESHOLD}</strong> كروت أو أقل.
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 7,
                    marginTop: 9
                  }}
                >
                  {lowStockPackages.map((pkg) => {
                    const available =
                      packageStats[pkg.id]?.available || 0;

                    const isOutOfStock = available === 0;

                    return (
                      <div
                        key={pkg.id}
                        style={{
                          borderRadius: 8,
                          border: isOutOfStock
                            ? '1px solid #d9b98e'
                            : '1px solid #dfc98f',
                          background: '#fafbfc',
                          color: isOutOfStock
                            ? '#a87345'
                            : '#8d7445',
                          padding: '7px 10px',
                          fontSize: 11.5,
                          fontWeight: 850,
                          boxShadow:
                            '0 2px 6px rgba(38, 50, 56, 0.025)'
                        }}
                      >
                        {pkg.name} —{' '}
                        {isOutOfStock
                          ? 'نفد المخزون'
                          : `${available} متاح`}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* الإحصائيات */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 12,
            marginBottom: 18
          }}
        >
          <StatCard
            title="إجمالي الباقات"
            value={packages.length}
            icon={<PackageIcon />}
            accent={{
              background: '#edf3f7',
              color: '#607f9e'
            }}
          />

          <StatCard
            title="إجمالي الكروت"
            value={totalCards}
            icon={<CardIcon />}
            accent={{
              background: '#f0f3f5',
              color: '#607078'
            }}
          />

          <StatCard
            title="الكروت المتاحة"
            value={totalAvailable}
            icon={<CardIcon />}
            accent={{
              background: '#edf6f0',
              color: '#6f9b7d'
            }}
          />

          <StatCard
            title="مع موزع"
            value={totalWithDistributor}
            icon={<CardIcon />}
            accent={{
              background: '#faf5e9',
              color: '#b79a62'
            }}
          />

          <StatCard
            title="الكروت المباعة"
            value={totalSold}
            icon={<CardIcon />}
            accent={{
              background: '#f9eeee',
              color: '#b87878'
            }}
          />
        </div>

        {/* إضافة باقة */}
        <div
          style={{
            background: '#fafbfc',
            border: '1px solid #dfe3e8',
            borderRadius: 15,
            padding: 18,
            marginBottom: 18,
            boxShadow:
              '0 3px 12px rgba(38, 50, 56, 0.035)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 15
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: '#edf3f7',
                color: '#607f9e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <PlusIcon />
            </div>

            <div>
              <h3
                style={{
                  margin: 0,
                  color: '#263238',
                  fontSize: 16,
                  fontWeight: 850
                }}
              >
                إضافة باقة جديدة
              </h3>

              <div
                style={{
                  color: '#90a0a8',
                  fontSize: 12,
                  marginTop: 3
                }}
              >
                أضف اسم الباقة وسعر الكرت
              </div>
            </div>
          </div>

          <form
            onSubmit={addPackage}
            style={{
              display: 'grid',
              gridTemplateColumns:
                'minmax(180px, 1fr) 160px 130px',
              gap: 10,
              alignItems: 'end'
            }}
          >
            <div
              className="field"
              style={{
                marginBottom: 0
              }}
            >
              <label>اسم الباقة</label>

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: باقة 20GB"
                style={{
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div
              className="field"
              style={{
                marginBottom: 0
              }}
            >
              <label>السعر لكل كرت</label>

              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="200"
                style={{
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={addingPackage}
              style={{
                height: 42,
                border: 'none',
                borderRadius: 9,
                background:
                  'linear-gradient(135deg, #607f9e, #6f8faa)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: 14,
                cursor: addingPackage
                  ? 'not-allowed'
                  : 'pointer',
                opacity: addingPackage ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                boxShadow:
                  '0 4px 10px rgba(96, 127, 158, 0.13)'
              }}
            >
              <PlusIcon />
              {addingPackage
                ? 'جاري الإضافة...'
                : 'إضافة الباقة'}
            </button>
          </form>
        </div>

        {/* الباقات */}
        <div
          style={{
            background: '#fafbfc',
            border: '1px solid #dfe3e8',
            borderRadius: 15,
            padding: 18,
            boxShadow:
              '0 3px 12px rgba(38, 50, 56, 0.035)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 16,
              flexWrap: 'wrap'
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  color: '#263238',
                  fontSize: 17,
                  fontWeight: 850
                }}
              >
                الباقات الحالية
              </h3>

              <p
                style={{
                  margin: '4px 0 0',
                  color: '#90a0a8',
                  fontSize: 12
                }}
              >
                إدارة الباقات ومتابعة أعداد الكروت التابعة لكل باقة
              </p>
            </div>

            <div
              style={{
                minWidth: 34,
                height: 30,
                padding: '0 10px',
                borderRadius: 8,
                background: '#edf3f7',
                color: '#607f9e',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 850
              }}
            >
              {packages.length}
            </div>
          </div>

          {packagesLoading ? (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                color: '#78909c',
                fontSize: 13
              }}
            >
              جاري تحميل الباقات...
            </div>
          ) : packages.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: 40,
                border: '1px dashed #c9d1d6',
                borderRadius: 12,
                background: '#f4f6f8'
              }}
            >
              <div
                style={{
                  color: '#455a64',
                  fontWeight: 800,
                  marginBottom: 5
                }}
              >
                لا توجد باقات حاليًا
              </div>

              <div
                style={{
                  color: '#90a0a8',
                  fontSize: 12
                }}
              >
                يمكنك إضافة أول باقة من النموذج أعلاه.
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 13
              }}
            >
              {packages.map((p) => {
                const stats = packageStats[p.id] || {
                  total: 0,
                  available: 0,
                  withDistributor: 0,
                  sold: 0
                };

                const isLowStock =
                  stats.available <= LOW_STOCK_THRESHOLD;

                const isOutOfStock =
                  stats.available === 0;

                return (
                  <div
                    key={p.id}
                    style={{
                      background: '#fafbfc',
                      border: isOutOfStock
                        ? '1px solid #d9b98e'
                        : isLowStock
                        ? '1px solid #dfc98f'
                        : '1px solid #dfe3e8',
                      borderRadius: 13,
                      overflow: 'hidden',
                      boxShadow:
                        '0 3px 10px rgba(38, 50, 56, 0.03)'
                    }}
                  >
                    {/* رأس الباقة */}
                    <div
                      style={{
                        padding: 15
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 12
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
                              display: 'flex',
                              alignItems: 'center',
                              gap: 9
                            }}
                          >
                            <div
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: 10,
                                background: isOutOfStock
                                  ? '#faf3ea'
                                  : isLowStock
                                  ? '#faf5e9'
                                  : '#edf3f7',
                                color: isOutOfStock
                                  ? '#b07d48'
                                  : isLowStock
                                  ? '#a5874f'
                                  : '#607f9e',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                            >
                              {isLowStock ? (
                                <WarningIcon />
                              ) : (
                                <PackageIcon />
                              )}
                            </div>

                            <div
                              style={{
                                minWidth: 0
                              }}
                            >
                              <div
                                style={{
                                  color: '#263238',
                                  fontSize: 15,
                                  fontWeight: 900,
                                  wordBreak: 'break-word'
                                }}
                              >
                                {p.name}
                              </div>

                              <div
                                style={{
                                  color: '#78909c',
                                  fontSize: 12,
                                  marginTop: 3
                                }}
                              >
                                {p.price} ريال للكرت
                              </div>
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            padding: '5px 9px',
                            borderRadius: 8,
                            background: isOutOfStock
                              ? '#faf3ea'
                              : isLowStock
                              ? '#faf5e9'
                              : '#edf6f0',
                            color: isOutOfStock
                              ? '#a87345'
                              : isLowStock
                              ? '#8d7445'
                              : '#5f8f70',
                            fontSize: 11,
                            fontWeight: 850,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {isOutOfStock
                            ? 'نفد المخزون'
                            : `${stats.available} متاح`}
                        </div>
                      </div>

                      {/* تنبيه المخزون */}
                      {isLowStock && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginTop: 11,
                            padding: '8px 9px',
                            borderRadius: 8,
                            background: isOutOfStock
                              ? '#faf3ea'
                              : '#faf5e9',
                            border: isOutOfStock
                              ? '1px solid #e5d1b6'
                              : '1px solid #e5d6b5',
                            color: isOutOfStock
                              ? '#a87345'
                              : '#8d7445',
                            fontSize: 11.5,
                            fontWeight: 850
                          }}
                        >
                          <WarningIcon />

                          <span>
                            {isOutOfStock
                              ? 'المخزون نافد — لا توجد كروت متاحة حاليًا'
                              : `مخزون منخفض — متبقي ${stats.available} كرت متاح فقط`}
                          </span>
                        </div>
                      )}

                      {/* إحصائيات الباقة */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            'repeat(4, minmax(0, 1fr))',
                          gap: 7,
                          marginTop: 13
                        }}
                      >
                        <div
                          style={{
                            padding: '9px 6px',
                            borderRadius: 8,
                            background: '#f0f3f5',
                            textAlign: 'center',
                            border:
                              '1px solid #e1e5e8'
                          }}
                        >
                          <div
                            style={{
                              color: '#607078',
                              fontSize: 10.5,
                              fontWeight: 700
                            }}
                          >
                            الإجمالي
                          </div>

                          <div
                            style={{
                              color: '#455a64',
                              fontSize: 15,
                              fontWeight: 900,
                              marginTop: 2
                            }}
                          >
                            {stats.total}
                          </div>
                        </div>

                        <div
                          style={{
                            padding: '9px 6px',
                            borderRadius: 8,
                            background: isLowStock
                              ? '#faf5e9'
                              : '#edf6f0',
                            textAlign: 'center'
                          }}
                        >
                          <div
                            style={{
                              color: isLowStock
                                ? '#9a7b45'
                                : '#5f8f70',
                              fontSize: 10.5,
                              fontWeight: 700
                            }}
                          >
                            متاح
                          </div>

                          <div
                            style={{
                              color: isLowStock
                                ? '#8d7445'
                                : '#557e64',
                              fontSize: 15,
                              fontWeight: 900,
                              marginTop: 2
                            }}
                          >
                            {stats.available}
                          </div>
                        </div>

                        <div
                          style={{
                            padding: '9px 6px',
                            borderRadius: 8,
                            background: '#faf5e9',
                            textAlign: 'center'
                          }}
                        >
                          <div
                            style={{
                              color: '#9a7b45',
                              fontSize: 10.5,
                              fontWeight: 700
                            }}
                          >
                            مع موزع
                          </div>

                          <div
                            style={{
                              color: '#8d7445',
                              fontSize: 15,
                              fontWeight: 900,
                              marginTop: 2
                            }}
                          >
                            {stats.withDistributor}
                          </div>
                        </div>

                        <div
                          style={{
                            padding: '9px 6px',
                            borderRadius: 8,
                            background: '#f9eeee',
                            textAlign: 'center'
                          }}
                        >
                          <div
                            style={{
                              color: '#b87878',
                              fontSize: 10.5,
                              fontWeight: 700
                            }}
                          >
                            مباع
                          </div>

                          <div
                            style={{
                              color: '#ad6b6b',
                              fontSize: 15,
                              fontWeight: 900,
                              marginTop: 2
                            }}
                          >
                            {stats.sold}
                          </div>
                        </div>
                      </div>

                      {/* زر حذف الباقة */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          marginTop: 12
                        }}
                      >
                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() =>
                            deletePackage(p.id, p.name)
                          }
                          style={{
                            height: 37,
                            padding: '0 13px',
                            borderRadius: 8,
                            border:
                              '1px solid #e7caca',
                            background: '#f9eeee',
                            color: '#b87878',
                            fontWeight: 850,
                            fontSize: 12,
                            cursor:
                              busyId === p.id
                                ? 'not-allowed'
                                : 'pointer',
                            opacity:
                              busyId === p.id ? 0.65 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 5
                          }}
                        >
                          <TrashIcon />

                          {busyId === p.id
                            ? 'حذف...'
                            : 'حذف الباقة'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 700px) {
          .main {
            padding-left: 12px !important;
            padding-right: 12px !important;
          }

          form {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 520px) {
          h1 {
            font-size: 21px !important;
          }
        }

        @media (max-width: 390px) {
          .main {
            padding-left: 9px !important;
            padding-right: 9px !important;
          }
        }
      `}</style>
    </div>
  );
}
