'use client';

import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

const PAGE_SIZE = 50;

const STATUS_LABELS = {
  available: 'متاح',
  with_distributor: 'مع موزع',
  sold: 'مباع'
};

const STATUS_STYLES = {
  available: {
    background: '#dcfce7',
    color: '#166534'
  },
  with_distributor: {
    background: '#fef3c7',
    color: '#92400e'
  },
  sold: {
    background: '#fee2e2',
    color: '#991b1b'
  }
};

export default function PackagesPage() {
  const { profile, loading } = useProfile('admin');

  const [packages, setPackages] = useState([]);

  // إضافة الباقة
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');

  // الأخطاء والحالة العامة
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  // الباقة المفتوحة
  const [expandedPackageId, setExpandedPackageId] = useState(null);

  // كروت كل باقة
  const [packageCards, setPackageCards] = useState({});
  const [packageCardLoading, setPackageCardLoading] = useState({});
  const [packageCardSearch, setPackageCardSearch] = useState({});
  const [packageCardStatus, setPackageCardStatus] = useState({});
  const [packageCardPage, setPackageCardPage] = useState({});

  // البحث العام عن أي كرت
  const [globalCardSearch, setGlobalCardSearch] = useState('');
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [globalSearchResults, setGlobalSearchResults] = useState([]);
  const [globalSearchDone, setGlobalSearchDone] = useState(false);

  // نسخ الكود
  const [copiedCode, setCopiedCode] = useState('');

  // حذف كرت
  const [deletingCardId, setDeletingCardId] = useState(null);

  // إحصائيات الباقات
  const [packageStats, setPackageStats] = useState({});

  async function loadPackages() {
    const { data, error: fetchError } = await supabase
      .from('packages')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError || !data) {
      setPackages([]);
      setError('تعذّر تحميل الباقات');
      return;
    }

    setPackages(data);

    // جلب إحصائيات الكروت لكل باقة.
    // لا يتم جلب جميع الكروت هنا، وإنما أعداد فقط.
    const statsEntries = await Promise.all(
      data.map(async (pkg) => {
        const [totalResult, availableResult, distributorResult, soldResult] =
          await Promise.all([
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

    const { error: insertError } = await supabase
      .from('packages')
      .insert({
        name: trimmedName,
        price: numericPrice
      });

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

    if (expandedPackageId === id) {
      setExpandedPackageId(null);
    }

    await loadPackages();
  }

  async function loadPackageCards(packageId, page = 0, search = '', status = 'all') {
    setPackageCardLoading((prev) => ({
      ...prev,
      [packageId]: true
    }));

    setError('');

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('cards')
      .select('id, code, package_id, status, assigned_to, sold_at, created_at')
      .eq('package_id', packageId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search.trim()) {
      query = query.ilike('code', `%${search.trim()}%`);
    }

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error: cardsError } = await query;

    setPackageCardLoading((prev) => ({
      ...prev,
      [packageId]: false
    }));

    if (cardsError) {
      setError('تعذّر تحميل كروت الباقة');
      return;
    }

    setPackageCards((prev) => ({
      ...prev,
      [packageId]: data || []
    }));

    setPackageCardPage((prev) => ({
      ...prev,
      [packageId]: page
    }));
  }

  async function togglePackage(packageId) {
    setError('');

    if (expandedPackageId === packageId) {
      setExpandedPackageId(null);
      return;
    }

    setExpandedPackageId(packageId);

    const search = packageCardSearch[packageId] || '';
    const status = packageCardStatus[packageId] || 'all';

    await loadPackageCards(packageId, 0, search, status);
  }

  async function applyPackageCardFilter(packageId) {
    const search = packageCardSearch[packageId] || '';
    const status = packageCardStatus[packageId] || 'all';

    await loadPackageCards(packageId, 0, search, status);
  }

  async function changePackageCardPage(packageId, newPage) {
    const search = packageCardSearch[packageId] || '';
    const status = packageCardStatus[packageId] || 'all';

    await loadPackageCards(packageId, newPage, search, status);
  }

  async function searchAllCards(e) {
    e.preventDefault();

    const search = globalCardSearch.trim();

    if (!search) {
      setGlobalSearchResults([]);
      setGlobalSearchDone(false);
      return;
    }

    setGlobalSearchLoading(true);
    setGlobalSearchDone(false);
    setError('');

    const { data, error: searchError } = await supabase
      .from('cards')
      .select(
        'id, code, package_id, status, assigned_to, sold_at, created_at, packages(name, price)'
      )
      .ilike('code', `%${search}%`)
      .order('created_at', { ascending: false })
      .limit(100);

    setGlobalSearchLoading(false);
    setGlobalSearchDone(true);

    if (searchError) {
      setGlobalSearchResults([]);
      setError('تعذّر البحث عن الكرت');
      return;
    }

    setGlobalSearchResults(data || []);
  }

  function clearGlobalSearch() {
    setGlobalCardSearch('');
    setGlobalSearchResults([]);
    setGlobalSearchDone(false);
  }

  async function copyCardCode(code) {
    try {
      await navigator.clipboard.writeText(String(code));
      setCopiedCode(String(code));

      setTimeout(() => {
        setCopiedCode('');
      }, 1500);
    } catch {
      setError('تعذّر نسخ الكود');
    }
  }

  async function deleteCard(card) {
    const code = String(card.code || '');

    if (
      !window.confirm(
        `هل أنت متأكد من حذف الكرت "${code}" نهائيًا؟\n\nسيتم حذف الكرت من جدول الكروت فقط.`
      )
    ) {
      return;
    }

    setDeletingCardId(card.id);
    setError('');

    const { error: deleteError } = await supabase
      .from('cards')
      .delete()
      .eq('id', card.id);

    setDeletingCardId(null);

    if (deleteError) {
      setError(
        'تعذّر حذف الكرت. قد يكون الكرت مرتبطًا ببيانات أخرى تمنع حذفه، أو قد تكون هناك حماية في قاعدة البيانات.'
      );
      return;
    }

    // إزالة الكرت من نتائج البحث الحالية
    setGlobalSearchResults((prev) =>
      prev.filter((item) => item.id !== card.id)
    );

    // تحديث قائمة الباقة إذا كانت مفتوحة
    if (card.package_id && expandedPackageId === card.package_id) {
      const page = packageCardPage[card.package_id] || 0;
      const search = packageCardSearch[card.package_id] || '';
      const status = packageCardStatus[card.package_id] || 'all';

      await loadPackageCards(
        card.package_id,
        page,
        search,
        status
      );
    }

    // تحديث الإحصائيات
    await loadPackages();
  }

  const totalCards = useMemo(
    () =>
      Object.values(packageStats).reduce(
        (sum, stats) => sum + (stats.total || 0),
        0
      ),
    [packageStats]
  );

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

  if (loading) return null;

  return (
    <div className="app">
      <Sidebar
        role="admin"
        active="/admin/packages"
        name={profile?.full_name}
      />

      <div className="main">
        <h1>الباقات</h1>

        <p className="greet" style={{ marginBottom: 20 }}>
          إدارة باقات الكروت وكروت النظام
        </p>

        {error && (
          <div
            className="error-note"
            style={{
              marginBottom: 16,
              whiteSpace: 'pre-line'
            }}
          >
            {error}
          </div>
        )}

        {/* إضافة باقة */}
        <div className="panel">
          <div className="panel-head">
            <h3>إضافة باقة جديدة</h3>
          </div>

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
                width: 140,
                maxWidth: '100%'
              }}
            >
              <label>السعر (لكل كرت)</label>

              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="25"
              />
            </div>

            <button
              className="btn-primary"
              style={{
                width: 140,
                maxWidth: '100%'
              }}
              type="submit"
            >
              إضافة
            </button>
          </form>
        </div>

        {/* البحث عن أي كرت */}
        <div className="panel">
          <div className="panel-head">
            <h3>البحث عن كرت</h3>
          </div>

          <p
            className="muted"
            style={{
              marginTop: -4,
              marginBottom: 14
            }}
          >
            ابحث عن أي كرت موجود في النظام باستخدام الكود.
          </p>

          <form
            onSubmit={searchAllCards}
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap'
            }}
          >
            <input
              value={globalCardSearch}
              onChange={(e) => setGlobalCardSearch(e.target.value)}
              placeholder="اكتب كود الكرت..."
              style={{
                flex: 1,
                minWidth: 200
              }}
            />

            <button
              type="submit"
              className="btn-primary"
              disabled={globalSearchLoading}
              style={{
                minWidth: 120
              }}
            >
              {globalSearchLoading ? 'جاري البحث...' : 'بحث'}
            </button>

            {globalSearchDone && (
              <button
                type="button"
                className="btn-sm"
                onClick={clearGlobalSearch}
                style={{
                  minWidth: 90,
                  padding: '8px 14px'
                }}
              >
                مسح
              </button>
            )}
          </form>

          {globalSearchDone && (
            <div style={{ marginTop: 18 }}>
              {globalSearchResults.length === 0 ? (
                <div
                  style={{
                    padding: 18,
                    textAlign: 'center',
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    color: '#6b7280'
                  }}
                >
                  لا يوجد كرت مطابق للبحث.
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gap: 10
                  }}
                >
                  {globalSearchResults.map((card) => {
                    const statusStyle =
                      STATUS_STYLES[card.status] || {
                        background: '#f3f4f6',
                        color: '#374151'
                      };

                    return (
                      <div
                        key={card.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          flexWrap: 'wrap',
                          padding: 14,
                          border: '1px solid #e5e7eb',
                          borderRadius: 10,
                          background: '#ffffff'
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 16,
                              fontWeight: 800,
                              color: '#111827',
                              wordBreak: 'break-all'
                            }}
                          >
                            {card.code}
                          </div>

                          <div
                            style={{
                              marginTop: 5,
                              display: 'flex',
                              gap: 10,
                              flexWrap: 'wrap',
                              fontSize: 13,
                              color: '#6b7280'
                            }}
                          >
                            <span>
                              الباقة:{' '}
                              {card.packages?.name || 'غير محددة'}
                            </span>

                            {card.packages?.price !== undefined && (
                              <span>
                                السعر: {card.packages.price} ريال
                              </span>
                            )}
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            flexWrap: 'wrap'
                          }}
                        >
                          <span
                            style={{
                              ...statusStyle,
                              padding: '5px 10px',
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 800
                            }}
                          >
                            {STATUS_LABELS[card.status] ||
                              card.status ||
                              'غير معروف'}
                          </span>

                          <button
                            type="button"
                            className="btn-sm"
                            onClick={() => copyCardCode(card.code)}
                            style={{
                              padding: '6px 10px'
                            }}
                          >
                            {copiedCode === String(card.code)
                              ? 'تم النسخ'
                              : 'نسخ'}
                          </button>

                          <button
                            type="button"
                            className="btn-sm"
                            disabled={deletingCardId === card.id}
                            onClick={() => deleteCard(card)}
                            style={{
                              backgroundColor: '#dc2626',
                              color: '#ffffff',
                              border: 'none',
                              padding: '6px 10px'
                            }}
                          >
                            {deletingCardId === card.id
                              ? 'حذف...'
                              : 'حذف'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* إحصائيات الكروت */}
        <div className="panel">
          <div className="panel-head">
            <h3>ملخص الكروت</h3>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 12,
              marginTop: 10
            }}
          >
            <div
              style={{
                padding: 16,
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                background: '#ffffff'
              }}
            >
              <div
                style={{
                  color: '#6b7280',
                  fontSize: 13,
                  marginBottom: 5
                }}
              >
                إجمالي الكروت
              </div>

              <strong
                style={{
                  fontSize: 24,
                  color: '#111827'
                }}
              >
                {totalCards}
              </strong>
            </div>

            <div
              style={{
                padding: 16,
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                background: '#ffffff'
              }}
            >
              <div
                style={{
                  color: '#6b7280',
                  fontSize: 13,
                  marginBottom: 5
                }}
              >
                متاح
              </div>

              <strong
                style={{
                  fontSize: 24,
                  color: '#166534'
                }}
              >
                {totalAvailable}
              </strong>
            </div>

            <div
              style={{
                padding: 16,
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                background: '#ffffff'
              }}
            >
              <div
                style={{
                  color: '#6b7280',
                  fontSize: 13,
                  marginBottom: 5
                }}
              >
                مع موزع
              </div>

              <strong
                style={{
                  fontSize: 24,
                  color: '#92400e'
                }}
              >
                {totalWithDistributor}
              </strong>
            </div>

            <div
              style={{
                padding: 16,
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                background: '#ffffff'
              }}
            >
              <div
                style={{
                  color: '#6b7280',
                  fontSize: 13,
                  marginBottom: 5
                }}
              >
                مباع
              </div>

              <strong
                style={{
                  fontSize: 24,
                  color: '#991b1b'
                }}
              >
                {totalSold}
              </strong>
            </div>
          </div>
        </div>

        {/* الباقات */}
        <div className="panel">
          <div className="panel-head">
            <h3>الباقات الحالية</h3>
            <span className="muted">{packages.length}</span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 14,
              marginTop: 10
            }}
          >
            {packages.map((p) => {
              const stats = packageStats[p.id] || {
                total: 0,
                available: 0,
                withDistributor: 0,
                sold: 0
              };

              const isExpanded = expandedPackageId === p.id;
              const cards = packageCards[p.id] || [];
              const currentPage = packageCardPage[p.id] || 0;
              const currentSearch =
                packageCardSearch[p.id] || '';
              const currentStatus =
                packageCardStatus[p.id] || 'all';

              return (
                <div
                  key={p.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    overflow: 'hidden',
                    boxSizing: 'border-box'
                  }}
                >
                  {/* معلومات الباقة */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      minHeight: 82,
                      padding: '14px 18px'
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
                          {stats.total} كرت
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: 7,
                        alignItems: 'center',
                        flexShrink: 0,
                        flexWrap: 'wrap',
                        justifyContent: 'flex-end'
                      }}
                    >
                      <button
                        type="button"
                        className="btn-sm"
                        onClick={() => togglePackage(p.id)}
                        style={{
                          padding: '7px 12px'
                        }}
                      >
                        {isExpanded
                          ? 'إخفاء الكروت'
                          : 'عرض الكروت'}
                      </button>

                      <button
                        className="btn-sm"
                        style={{
                          backgroundColor: '#dc2626',
                          color: '#ffffff',
                          opacity: 1,
                          padding: '6px 14px',
                          borderRadius: '6px',
                          border: 'none'
                        }}
                        disabled={busyId === p.id}
                        onClick={() => deletePackage(p.id, p.name)}
                      >
                        {busyId === p.id ? 'حذف...' : 'حذف'}
                      </button>
                    </div>
                  </div>

                  {/* إحصائيات الباقة */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(3, minmax(0, 1fr))',
                      borderTop: '1px solid #f1f5f9',
                      borderBottom: isExpanded
                        ? '1px solid #e5e7eb'
                        : 'none'
                    }}
                  >
                    <div
                      style={{
                        padding: '9px 8px',
                        textAlign: 'center'
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          color: '#6b7280'
                        }}
                      >
                        متاح
                      </div>

                      <strong
                        style={{
                          color: '#166534',
                          fontSize: 15
                        }}
                      >
                        {stats.available}
                      </strong>
                    </div>

                    <div
                      style={{
                        padding: '9px 8px',
                        textAlign: 'center',
                        borderRight: '1px solid #f1f5f9',
                        borderLeft: '1px solid #f1f5f9'
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          color: '#6b7280'
                        }}
                      >
                        مع موزع
                      </div>

                      <strong
                        style={{
                          color: '#92400e',
                          fontSize: 15
                        }}
                      >
                        {stats.withDistributor}
                      </strong>
                    </div>

                    <div
                      style={{
                        padding: '9px 8px',
                        textAlign: 'center'
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          color: '#6b7280'
                        }}
                      >
                        مباع
                      </div>

                      <strong
                        style={{
                          color: '#991b1b',
                          fontSize: 15
                        }}
                      >
                        {stats.sold}
                      </strong>
                    </div>
                  </div>

                  {/* إدارة كروت الباقة */}
                  {isExpanded && (
                    <div
                      style={{
                        padding: 14,
                        background: '#f8fafc'
                      }}
                    >
                      {/* بحث وفلترة */}
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          flexWrap: 'wrap',
                          marginBottom: 14
                        }}
                      >
                        <input
                          value={currentSearch}
                          onChange={(e) =>
                            setPackageCardSearch((prev) => ({
                              ...prev,
                              [p.id]: e.target.value
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              applyPackageCardFilter(p.id);
                            }
                          }}
                          placeholder="بحث عن كود..."
                          style={{
                            flex: 1,
                            minWidth: 150
                          }}
                        />

                        <select
                          value={currentStatus}
                          onChange={(e) => {
                            const value = e.target.value;

                            setPackageCardStatus((prev) => ({
                              ...prev,
                              [p.id]: value
                            }));

                            setTimeout(() => {
                              loadPackageCards(
                                p.id,
                                0,
                                currentSearch,
                                value
                              );
                            }, 0);
                          }}
                          style={{
                            minWidth: 130
                          }}
                        >
                          <option value="all">
                            كل الحالات
                          </option>
                          <option value="available">
                            متاح
                          </option>
                          <option value="with_distributor">
                            مع موزع
                          </option>
                          <option value="sold">
                            مباع
                          </option>
                        </select>

                        <button
                          type="button"
                          className="btn-sm"
                          onClick={() =>
                            applyPackageCardFilter(p.id)
                          }
                          style={{
                            padding: '7px 12px'
                          }}
                        >
                          بحث
                        </button>
                      </div>

                      {packageCardLoading[p.id] ? (
                        <div
                          style={{
                            textAlign: 'center',
                            padding: 25,
                            color: '#6b7280'
                          }}
                        >
                          جاري تحميل الكروت...
                        </div>
                      ) : cards.length === 0 ? (
                        <div
                          style={{
                            textAlign: 'center',
                            padding: 25,
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: 8,
                            color: '#6b7280'
                          }}
                        >
                          لا توجد كروت مطابقة.
                        </div>
                      ) : (
                        <>
                          <div
                            style={{
                              display: 'grid',
                              gap: 8
                            }}
                          >
                            {cards.map((card) => {
                              const statusStyle =
                                STATUS_STYLES[card.status] || {
                                  background: '#f3f4f6',
                                  color: '#374151'
                                };

                              return (
                                <div
                                  key={card.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent:
                                      'space-between',
                                    gap: 8,
                                    flexWrap: 'wrap',
                                    padding: '10px 12px',
                                    background: '#ffffff',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: 8
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
                                        fontWeight: 800,
                                        color: '#111827',
                                        wordBreak: 'break-all'
                                      }}
                                    >
                                      {card.code}
                                    </div>

                                    <div
                                      style={{
                                        marginTop: 4,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 7,
                                        flexWrap: 'wrap'
                                      }}
                                    >
                                      <span
                                        style={{
                                          ...statusStyle,
                                          padding:
                                            '3px 8px',
                                          borderRadius:
                                            999,
                                          fontSize: 11,
                                          fontWeight: 800
                                        }}
                                      >
                                        {STATUS_LABELS[
                                          card.status
                                        ] ||
                                          card.status ||
                                          'غير معروف'}
                                      </span>
                                    </div>
                                  </div>

                                  <div
                                    style={{
                                      display: 'flex',
                                      gap: 6,
                                      flexWrap: 'wrap'
                                    }}
                                  >
                                    <button
                                      type="button"
                                      className="btn-sm"
                                      onClick={() =>
                                        copyCardCode(
                                          card.code
                                        )
                                      }
                                      style={{
                                        padding:
                                          '5px 9px'
                                      }}
                                    >
                                      {copiedCode ===
                                      String(card.code)
                                        ? 'تم النسخ'
                                        : 'نسخ'}
                                    </button>

                                    <button
                                      type="button"
                                      className="btn-sm"
                                      disabled={
                                        deletingCardId ===
                                        card.id
                                      }
                                      onClick={() =>
                                        deleteCard(card)
                                      }
                                      style={{
                                        backgroundColor:
                                          '#dc2626',
                                        color: '#ffffff',
                                        border: 'none',
                                        padding:
                                          '5px 9px'
                                      }}
                                    >
                                      {deletingCardId ===
                                      card.id
                                        ? 'حذف...'
                                        : 'حذف'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* التنقل بين الصفحات */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent:
                                'space-between',
                              gap: 10,
                              marginTop: 12,
                              flexWrap: 'wrap'
                            }}
                          >
                            <button
                              type="button"
                              className="btn-sm"
                              disabled={
                                currentPage === 0 ||
                                packageCardLoading[p.id]
                              }
                              onClick={() =>
                                changePackageCardPage(
                                  p.id,
                                  currentPage - 1
                                )
                              }
                              style={{
                                padding: '6px 12px'
                              }}
                            >
                              السابق
                            </button>

                            <span
                              style={{
                                fontSize: 12,
                                color: '#6b7280'
                              }}
                            >
                              الصفحة {currentPage + 1}
                            </span>

                            <button
                              type="button"
                              className="btn-sm"
                              disabled={
                                cards.length < PAGE_SIZE ||
                                packageCardLoading[p.id]
                              }
                              onClick={() =>
                                changePackageCardPage(
                                  p.id,
                                  currentPage + 1
                                )
                              }
                              style={{
                                padding: '6px 12px'
                              }}
                            >
                              التالي
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {packages.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: 30,
                color: '#6b7280'
              }}
            >
              لا توجد باقات حاليًا.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
