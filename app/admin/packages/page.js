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
    background: '#ecfdf5',
    color: '#047857',
    border: '#a7f3d0'
  },
  with_distributor: {
    background: '#fffbeb',
    color: '#b45309',
    border: '#fde68a'
  },
  sold: {
    background: '#fef2f2',
    color: '#dc2626',
    border: '#fecaca'
  }
};

function SearchIcon() {
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
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function CopyIcon() {
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
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
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

function ChevronIcon({ open }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s ease'
      }}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || {
    background: '#f8fafc',
    color: '#475569',
    border: '#e2e8f0'
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        borderRadius: 999,
        background: style.background,
        color: style.color,
        border: `1px solid ${style.border}`,
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: 'nowrap'
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: style.color
        }}
      />
      {STATUS_LABELS[status] || status || 'غير معروف'}
    </span>
  );
}

function StatCard({ icon, title, value, accent }) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 14,
        padding: '16px 17px',
        minWidth: 0,
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)'
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
              color: '#64748b',
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
              color: '#0f172a'
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

  const [expandedPackageId, setExpandedPackageId] = useState(null);

  const [packageCards, setPackageCards] = useState({});
  const [packageCardLoading, setPackageCardLoading] = useState({});
  const [packageCardSearch, setPackageCardSearch] = useState({});
  const [packageCardStatus, setPackageCardStatus] = useState({});
  const [packageCardPage, setPackageCardPage] = useState({});

  const [globalCardSearch, setGlobalCardSearch] = useState('');
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [globalSearchResults, setGlobalSearchResults] = useState([]);
  const [globalSearchDone, setGlobalSearchDone] = useState(false);

  const [copiedCode, setCopiedCode] = useState('');
  const [deletingCardId, setDeletingCardId] = useState(null);

  const [packageStats, setPackageStats] = useState({});
  const [packagesLoading, setPackagesLoading] = useState(true);

  async function loadPackages() {
    setPackagesLoading(true);

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

    if (expandedPackageId === id) {
      setExpandedPackageId(null);
    }

    await loadPackages();
  }

  async function loadPackageCards(
    packageId,
    page = 0,
    search = '',
    status = 'all'
  ) {
    setPackageCardLoading((prev) => ({
      ...prev,
      [packageId]: true
    }));

    setError('');

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('cards')
      .select(
        'id, code, package_id, status, assigned_to, sold_at, created_at'
      )
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

    setGlobalSearchResults((prev) =>
      prev.filter((item) => item.id !== card.id)
    );

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
    <div
      className="app"
      style={{
        background: '#f5f7fb',
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
                    'linear-gradient(135deg, #1d4ed8, #2563eb)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 7px 18px rgba(37, 99, 235, 0.20)'
                }}
              >
                <PackageIcon />
              </div>

              <div>
                <h1
                  style={{
                    margin: 0,
                    color: '#0f172a',
                    fontSize: 25,
                    fontWeight: 900,
                    letterSpacing: '-0.3px'
                  }}
                >
                  إدارة الباقات والكروت
                </h1>

                <p
                  style={{
                    margin: '5px 0 0',
                    color: '#64748b',
                    fontSize: 13.5
                  }}
                >
                  إدارة الباقات والكروت التابعة لها والبحث عنها بسهولة
                </p>
              </div>
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: '9px 13px',
              color: '#475569',
              fontSize: 13,
              fontWeight: 700
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
              background: '#fef2f2',
              color: '#b91c1c',
              border: '1px solid #fecaca',
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: 'pre-line'
            }}
          >
            {error}
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
              background: '#eff6ff',
              color: '#2563eb'
            }}
          />

          <StatCard
            title="إجمالي الكروت"
            value={totalCards}
            icon={<CardIcon />}
            accent={{
              background: '#f1f5f9',
              color: '#334155'
            }}
          />

          <StatCard
            title="الكروت المتاحة"
            value={totalAvailable}
            icon={<CardIcon />}
            accent={{
              background: '#ecfdf5',
              color: '#059669'
            }}
          />

          <StatCard
            title="مع موزع"
            value={totalWithDistributor}
            icon={<CardIcon />}
            accent={{
              background: '#fffbeb',
              color: '#d97706'
            }}
          />

          <StatCard
            title="الكروت المباعة"
            value={totalSold}
            icon={<CardIcon />}
            accent={{
              background: '#fef2f2',
              color: '#dc2626'
            }}
          />
        </div>

        {/* إضافة باقة */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 15,
            padding: 18,
            marginBottom: 18,
            boxShadow: '0 2px 10px rgba(15, 23, 42, 0.025)'
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
                background: '#eff6ff',
                color: '#2563eb',
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
                  color: '#0f172a',
                  fontSize: 16,
                  fontWeight: 850
                }}
              >
                إضافة باقة جديدة
              </h3>

              <div
                style={{
                  color: '#94a3b8',
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
                  'linear-gradient(135deg, #1d4ed8, #2563eb)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: 14,
                cursor: addingPackage ? 'not-allowed' : 'pointer',
                opacity: addingPackage ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                boxShadow:
                  '0 5px 12px rgba(37, 99, 235, 0.16)'
              }}
            >
              <PlusIcon />
              {addingPackage ? 'جاري الإضافة...' : 'إضافة الباقة'}
            </button>
          </form>
        </div>

        {/* البحث المركزي */}
        <div
          style={{
            background:
              'linear-gradient(135deg, #172554 0%, #1e40af 100%)',
            borderRadius: 16,
            padding: 20,
            marginBottom: 18,
            boxShadow: '0 10px 25px rgba(30, 64, 175, 0.12)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              marginBottom: 13
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.12)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <SearchIcon />
            </div>

            <div>
              <h3
                style={{
                  margin: 0,
                  color: '#ffffff',
                  fontSize: 17,
                  fontWeight: 850
                }}
              >
                البحث عن كرت
              </h3>

              <p
                style={{
                  margin: '4px 0 0',
                  color: '#bfdbfe',
                  fontSize: 12.5
                }}
              >
                ابحث عن أي كرت في النظام باستخدام رقم الكرت
              </p>
            </div>
          </div>

          <form
            onSubmit={searchAllCards}
            style={{
              display: 'flex',
              gap: 9,
              flexWrap: 'wrap'
            }}
          >
            <div
              style={{
                position: 'relative',
                flex: 1,
                minWidth: 190
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  right: 13,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  pointerEvents: 'none'
                }}
              >
                <SearchIcon />
              </div>

              <input
                value={globalCardSearch}
                onChange={(e) =>
                  setGlobalCardSearch(e.target.value)
                }
                placeholder="اكتب رقم الكرت للبحث..."
                style={{
                  width: '100%',
                  height: 44,
                  boxSizing: 'border-box',
                  padding: '0 45px 0 14px',
                  borderRadius: 9,
                  border: '1px solid #dbeafe',
                  background: '#ffffff',
                  color: '#0f172a',
                  outline: 'none',
                  fontSize: 14
                }}
              />
            </div>

            <button
              type="submit"
              disabled={globalSearchLoading}
              style={{
                height: 44,
                minWidth: 105,
                border: 'none',
                borderRadius: 9,
                background: '#ffffff',
                color: '#1d4ed8',
                fontWeight: 850,
                cursor: globalSearchLoading
                  ? 'not-allowed'
                  : 'pointer',
                opacity: globalSearchLoading ? 0.75 : 1
              }}
            >
              {globalSearchLoading ? 'جاري البحث...' : 'بحث'}
            </button>

            {globalSearchDone && (
              <button
                type="button"
                onClick={clearGlobalSearch}
                style={{
                  height: 44,
                  minWidth: 80,
                  borderRadius: 9,
                  border: '1px solid rgba(255,255,255,0.25)',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#ffffff',
                  fontWeight: 750,
                  cursor: 'pointer'
                }}
              >
                مسح
              </button>
            )}
          </form>

          {globalSearchDone && (
            <div
              style={{
                marginTop: 14,
                background: '#f8fafc',
                borderRadius: 11,
                padding: 10
              }}
            >
              {globalSearchResults.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: 25,
                    color: '#64748b',
                    background: '#ffffff',
                    borderRadius: 9,
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <div
                    style={{
                      fontWeight: 800,
                      color: '#334155',
                      marginBottom: 5
                    }}
                  >
                    لم يتم العثور على الكرت
                  </div>

                  <div style={{ fontSize: 12 }}>
                    تأكد من رقم الكرت وحاول مرة أخرى.
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gap: 8
                  }}
                >
                  {globalSearchResults.map((card) => (
                    <div
                      key={card.id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 10,
                        padding: '11px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap'
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
                            gap: 9,
                            flexWrap: 'wrap'
                          }}
                        >
                          <span
                            style={{
                              fontSize: 15,
                              fontWeight: 900,
                              color: '#0f172a',
                              wordBreak: 'break-all'
                            }}
                          >
                            {card.code}
                          </span>

                          <StatusBadge status={card.status} />
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            gap: 14,
                            flexWrap: 'wrap',
                            marginTop: 6,
                            color: '#64748b',
                            fontSize: 12
                          }}
                        >
                          <span>
                            الباقة:{' '}
                            <strong style={{ color: '#334155' }}>
                              {card.packages?.name || 'غير محددة'}
                            </strong>
                          </span>

                          {card.packages?.price !== undefined && (
                            <span>
                              السعر:{' '}
                              <strong style={{ color: '#334155' }}>
                                {card.packages.price} ريال
                              </strong>
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          gap: 7,
                          flexWrap: 'wrap'
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => copyCardCode(card.code)}
                          style={{
                            height: 34,
                            padding: '0 11px',
                            borderRadius: 8,
                            border: '1px solid #dbeafe',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            fontWeight: 800,
                            fontSize: 12,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            cursor: 'pointer'
                          }}
                        >
                          <CopyIcon />
                          {copiedCode === String(card.code)
                            ? 'تم النسخ'
                            : 'نسخ'}
                        </button>

                        <button
                          type="button"
                          disabled={deletingCardId === card.id}
                          onClick={() => deleteCard(card)}
                          style={{
                            height: 34,
                            padding: '0 11px',
                            borderRadius: 8,
                            border: '1px solid #fecaca',
                            background: '#fef2f2',
                            color: '#dc2626',
                            fontWeight: 800,
                            fontSize: 12,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            cursor:
                              deletingCardId === card.id
                                ? 'not-allowed'
                                : 'pointer',
                            opacity:
                              deletingCardId === card.id
                                ? 0.65
                                : 1
                          }}
                        >
                          <TrashIcon />
                          {deletingCardId === card.id
                            ? 'حذف...'
                            : 'حذف'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* الباقات */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 15,
            padding: 18,
            boxShadow: '0 2px 10px rgba(15, 23, 42, 0.025)'
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
                  color: '#0f172a',
                  fontSize: 17,
                  fontWeight: 850
                }}
              >
                الباقات الحالية
              </h3>

              <p
                style={{
                  margin: '4px 0 0',
                  color: '#94a3b8',
                  fontSize: 12
                }}
              >
                اختر أي باقة لعرض وإدارة الكروت التابعة لها
              </p>
            </div>

            <div
              style={{
                minWidth: 34,
                height: 30,
                padding: '0 10px',
                borderRadius: 8,
                background: '#eff6ff',
                color: '#1d4ed8',
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
                color: '#64748b',
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
                border: '1px dashed #cbd5e1',
                borderRadius: 12,
                background: '#f8fafc'
              }}
            >
              <div
                style={{
                  color: '#334155',
                  fontWeight: 800,
                  marginBottom: 5
                }}
              >
                لا توجد باقات حاليًا
              </div>

              <div
                style={{
                  color: '#94a3b8',
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
                  'repeat(auto-fit, minmax(330px, 1fr))',
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
                      border: isExpanded
                        ? '1px solid #93c5fd'
                        : '1px solid #e2e8f0',
                      borderRadius: 13,
                      overflow: 'hidden',
                      boxShadow: isExpanded
                        ? '0 5px 18px rgba(37, 99, 235, 0.08)'
                        : '0 2px 8px rgba(15, 23, 42, 0.025)',
                      transition: 'all 0.2s ease'
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
                              gap: 9,
                              marginBottom: 8
                            }}
                          >
                            <div
                              style={{
                                width: 35,
                                height: 35,
                                borderRadius: 9,
                                background: '#eff6ff',
                                color: '#2563eb',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                            >
                              <PackageIcon />
                            </div>

                            <div
                              style={{
                                minWidth: 0
                              }}
                            >
                              <div
                                style={{
                                  color: '#0f172a',
                                  fontSize: 15,
                                  fontWeight: 900,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {p.name}
                              </div>

                              <div
                                style={{
                                  color: '#64748b',
                                  fontSize: 12,
                                  marginTop: 2
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
                            background: '#f8fafc',
                            color: '#475569',
                            fontSize: 11,
                            fontWeight: 850,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {stats.total} كرت
                        </div>
                      </div>

                      {/* أرقام الحالة */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            'repeat(3, minmax(0, 1fr))',
                          gap: 7,
                          marginTop: 13
                        }}
                      >
                        <div
                          style={{
                            padding: '8px 7px',
                            borderRadius: 8,
                            background: '#ecfdf5',
                            textAlign: 'center'
                          }}
                        >
                          <div
                            style={{
                              color: '#047857',
                              fontSize: 11,
                              fontWeight: 700
                            }}
                          >
                            متاح
                          </div>

                          <div
                            style={{
                              color: '#065f46',
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
                            padding: '8px 7px',
                            borderRadius: 8,
                            background: '#fffbeb',
                            textAlign: 'center'
                          }}
                        >
                          <div
                            style={{
                              color: '#b45309',
                              fontSize: 11,
                              fontWeight: 700
                            }}
                          >
                            مع موزع
                          </div>

                          <div
                            style={{
                              color: '#92400e',
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
                            padding: '8px 7px',
                            borderRadius: 8,
                            background: '#fef2f2',
                            textAlign: 'center'
                          }}
                        >
                          <div
                            style={{
                              color: '#dc2626',
                              fontSize: 11,
                              fontWeight: 700
                            }}
                          >
                            مباع
                          </div>

                          <div
                            style={{
                              color: '#b91c1c',
                              fontSize: 15,
                              fontWeight: 900,
                              marginTop: 2
                            }}
                          >
                            {stats.sold}
                          </div>
                        </div>
                      </div>

                      {/* أزرار الباقة */}
                      <div
                        style={{
                          display: 'flex',
                          gap: 7,
                          marginTop: 12
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => togglePackage(p.id)}
                          style={{
                            flex: 1,
                            height: 37,
                            borderRadius: 8,
                            border: '1px solid #bfdbfe',
                            background: isExpanded
                              ? '#dbeafe'
                              : '#eff6ff',
                            color: '#1d4ed8',
                            fontWeight: 850,
                            fontSize: 12,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6
                          }}
                        >
                          {isExpanded
                            ? 'إخفاء الكروت'
                            : 'عرض الكروت'}
                          <ChevronIcon open={isExpanded} />
                        </button>

                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() =>
                            deletePackage(p.id, p.name)
                          }
                          style={{
                            height: 37,
                            padding: '0 12px',
                            borderRadius: 8,
                            border: '1px solid #fecaca',
                            background: '#fef2f2',
                            color: '#dc2626',
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
                            : 'حذف'}
                        </button>
                      </div>
                    </div>

                    {/* كروت الباقة */}
                    {isExpanded && (
                      <div
                        style={{
                          borderTop: '1px solid #e2e8f0',
                          background: '#f8fafc',
                          padding: 13
                        }}
                      >
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns:
                              'minmax(150px, 1fr) 125px auto',
                            gap: 7,
                            marginBottom: 11
                          }}
                        >
                          <input
                            value={currentSearch}
                            onChange={(e) =>
                              setPackageCardSearch(
                                (prev) => ({
                                  ...prev,
                                  [p.id]: e.target.value
                                })
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                applyPackageCardFilter(p.id);
                              }
                            }}
                            placeholder="بحث برقم الكرت..."
                            style={{
                              width: '100%',
                              boxSizing: 'border-box'
                            }}
                          />

                          <select
                            value={currentStatus}
                            onChange={(e) => {
                              const value = e.target.value;

                              setPackageCardStatus(
                                (prev) => ({
                                  ...prev,
                                  [p.id]: value
                                })
                              );

                              loadPackageCards(
                                p.id,
                                0,
                                currentSearch,
                                value
                              );
                            }}
                            style={{
                              width: '100%',
                              boxSizing: 'border-box'
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
                            onClick={() =>
                              applyPackageCardFilter(p.id)
                            }
                            style={{
                              height: 40,
                              padding: '0 12px',
                              borderRadius: 8,
                              border: 'none',
                              background: '#2563eb',
                              color: '#ffffff',
                              fontWeight: 800,
                              fontSize: 12,
                              cursor: 'pointer'
                            }}
                          >
                            بحث
                          </button>
                        </div>

                        {packageCardLoading[p.id] ? (
                          <div
                            style={{
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: 9,
                              padding: 25,
                              textAlign: 'center',
                              color: '#64748b',
                              fontSize: 12
                            }}
                          >
                            جاري تحميل الكروت...
                          </div>
                        ) : cards.length === 0 ? (
                          <div
                            style={{
                              background: '#ffffff',
                              border: '1px dashed #cbd5e1',
                              borderRadius: 9,
                              padding: 25,
                              textAlign: 'center',
                              color: '#64748b',
                              fontSize: 12
                            }}
                          >
                            لا توجد كروت مطابقة.
                          </div>
                        ) : (
                          <>
                            <div
                              style={{
                                display: 'grid',
                                gap: 7
                              }}
                            >
                              {cards.map((card) => (
                                <div
                                  key={card.id}
                                  style={{
                                    background: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 9,
                                    padding:
                                      '9px 10px',
                                    display: 'flex',
                                    alignItems:
                                      'center',
                                    justifyContent:
                                      'space-between',
                                    gap: 9,
                                    flexWrap: 'wrap'
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
                                        display:
                                          'flex',
                                        alignItems:
                                          'center',
                                        gap: 8,
                                        flexWrap:
                                          'wrap'
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontWeight:
                                            900,
                                          color:
                                            '#0f172a',
                                          fontSize: 14,
                                          wordBreak:
                                            'break-all'
                                        }}
                                      >
                                        {card.code}
                                      </span>

                                      <StatusBadge
                                        status={
                                          card.status
                                        }
                                      />
                                    </div>
                                  </div>

                                  <div
                                    style={{
                                      display: 'flex',
                                      gap: 6
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        copyCardCode(
                                          card.code
                                        )
                                      }
                                      style={{
                                        height: 32,
                                        padding:
                                          '0 9px',
                                        borderRadius: 7,
                                        border:
                                          '1px solid #dbeafe',
                                        background:
                                          '#eff6ff',
                                        color:
                                          '#1d4ed8',
                                        fontWeight:
                                          800,
                                        fontSize: 11,
                                        display:
                                          'inline-flex',
                                        alignItems:
                                          'center',
                                        gap: 5,
                                        cursor:
                                          'pointer'
                                      }}
                                    >
                                      <CopyIcon />
                                      {copiedCode ===
                                      String(
                                        card.code
                                      )
                                        ? 'تم النسخ'
                                        : 'نسخ'}
                                    </button>

                                    <button
                                      type="button"
                                      disabled={
                                        deletingCardId ===
                                        card.id
                                      }
                                      onClick={() =>
                                        deleteCard(
                                          card
                                        )
                                      }
                                      style={{
                                        height: 32,
                                        padding:
                                          '0 9px',
                                        borderRadius: 7,
                                        border:
                                          '1px solid #fecaca',
                                        background:
                                          '#fef2f2',
                                        color:
                                          '#dc2626',
                                        fontWeight:
                                          800,
                                        fontSize: 11,
                                        display:
                                          'inline-flex',
                                        alignItems:
                                          'center',
                                        gap: 5,
                                        cursor:
                                          deletingCardId ===
                                          card.id
                                            ? 'not-allowed'
                                            : 'pointer',
                                        opacity:
                                          deletingCardId ===
                                          card.id
                                            ? 0.6
                                            : 1
                                      }}
                                    >
                                      <TrashIcon />
                                      {deletingCardId ===
                                      card.id
                                        ? 'حذف...'
                                        : 'حذف'}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                alignItems:
                                  'center',
                                justifyContent:
                                  'space-between',
                                gap: 8,
                                marginTop: 10,
                                flexWrap: 'wrap'
                              }}
                            >
                              <button
                                type="button"
                                disabled={
                                  currentPage === 0 ||
                                  packageCardLoading[
                                    p.id
                                  ]
                                }
                                onClick={() =>
                                  changePackageCardPage(
                                    p.id,
                                    currentPage - 1
                                  )
                                }
                                style={{
                                  height: 32,
                                  padding: '0 11px',
                                  borderRadius: 7,
                                  border:
                                    '1px solid #cbd5e1',
                                  background:
                                    '#ffffff',
                                  color: '#475569',
                                  fontWeight: 750,
                                  fontSize: 11,
                                  cursor:
                                    currentPage === 0
                                      ? 'not-allowed'
                                      : 'pointer',
                                  opacity:
                                    currentPage === 0
                                      ? 0.5
                                      : 1
                                }}
                              >
                                السابق
                              </button>

                              <span
                                style={{
                                  color: '#64748b',
                                  fontSize: 11,
                                  fontWeight: 700
                                }}
                              >
                                الصفحة {currentPage + 1}
                              </span>

                              <button
                                type="button"
                                disabled={
                                  cards.length <
                                    PAGE_SIZE ||
                                  packageCardLoading[
                                    p.id
                                  ]
                                }
                                onClick={() =>
                                  changePackageCardPage(
                                    p.id,
                                    currentPage + 1
                                  )
                                }
                                style={{
                                  height: 32,
                                  padding: '0 11px',
                                  borderRadius: 7,
                                  border:
                                    '1px solid #cbd5e1',
                                  background:
                                    '#ffffff',
                                  color: '#475569',
                                  fontWeight: 750,
                                  fontSize: 11,
                                  cursor:
                                    cards.length <
                                    PAGE_SIZE
                                      ? 'not-allowed'
                                      : 'pointer',
                                  opacity:
                                    cards.length <
                                    PAGE_SIZE
                                      ? 0.5
                                      : 1
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

        @media (max-width: 480px) {
          h1 {
            font-size: 21px !important;
          }
        }
      `}</style>
    </div>
  );
}
