'use client';

import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useProfile } from '../../../lib/useProfile';
import { supabase } from '../../../lib/supabase';

const statusLabel = {
  available: ['متاح', 'green'],
  with_distributor: ['مع موزع', 'amber'],
  sold: ['مباع', 'red'],
};

export default function CardsPage() {
  const { profile, loading } = useProfile('admin');

  const [packages, setPackages] = useState([]);
  const [cards, setCards] = useState([]);
  const [selected, setSelected] = useState(new Set());

  const [previewDate, setPreviewDate] = useState('');
  const [previewPackageId, setPreviewPackageId] = useState('');

  const [code, setCode] = useState('');
  const [packageId, setPackageId] = useState('');
  const [error, setError] = useState('');

  const [bulkText, setBulkText] = useState('');
  const [bulkPackageId, setBulkPackageId] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [bulkDone, setBulkDone] = useState('');

  const [deletingId, setDeletingId] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [addingBulk, setAddingBulk] = useState(false);

  async function loadAll() {
    setLoadingData(true);

    try {
      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);

      await supabase
        .from('cards')
        .delete()
        .eq('status', 'sold')
        .lt('sold_at', oneDayAgo.toISOString());

      const [{ data: pkgs, error: packagesError }, { data: crds, error: cardsError }] =
        await Promise.all([
          supabase
            .from('packages')
            .select('*')
            .order('created_at', { ascending: true }),

          supabase
            .from('cards')
            .select('*, packages(name)')
            .order('created_at', { ascending: false })
            .limit(200),
        ]);

      if (packagesError) {
        console.error('Packages loading error:', packagesError);
      }

      if (cardsError) {
        console.error('Cards loading error:', cardsError);
      }

      setPackages(pkgs || []);
      setCards(crds || []);
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    if (profile) {
      loadAll();
    }
  }, [profile]);

  const filteredCards = useMemo(() => {
    return cards.filter((c) => {
      const cardDate = c.created_at ? c.created_at.split('T')[0] : '';

      const matchDate =
        !previewDate || cardDate === previewDate;

      const matchPackage =
        !previewPackageId || c.package_id === previewPackageId;

      return matchDate && matchPackage;
    });
  }, [cards, previewDate, previewPackageId]);

  const statistics = useMemo(() => {
    return {
      total: cards.length,
      available: cards.filter((c) => c.status === 'available').length,
      withDistributor: cards.filter((c) => c.status === 'with_distributor').length,
      sold: cards.filter((c) => c.status === 'sold').length,
    };
  }, [cards]);

  function toggleAll() {
    if (
      selected.size === filteredCards.length &&
      filteredCards.length > 0
    ) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredCards.map((c) => c.id)));
    }
  }

  function toggle(id) {
    const next = new Set(selected);

    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }

    setSelected(next);
  }

  async function addCard(e) {
    e.preventDefault();

    setError('');

    if (!code || !packageId) {
      setError('أدخل رقم الكرت واختر الباقة');
      return;
    }

    setAddingCard(true);

    try {
      const { error: insertError } = await supabase
        .from('cards')
        .insert({
          code,
          package_id: packageId,
        });

      if (insertError) {
        console.error(insertError);
        setError(
          insertError.code === '23505'
            ? 'هذا الكرت موجود مسبقًا'
            : 'تعذّرت إضافة الكرت'
        );
        return;
      }

      setCode('');
      await loadAll();
    } finally {
      setAddingCard(false);
    }
  }

  async function addBulkCards(e) {
    e.preventDefault();

    setBulkError('');
    setBulkDone('');

    if (!bulkPackageId) {
      setBulkError('اختر الباقة أولاً');
      return;
    }

    const codes = [
      ...new Set(
        bulkText
          .split(/\r?\n/)
          .map((line) =>
            line
              .trim()
              .replace(/\D/g, '')
          )
          .filter((c) => c.length >= 5)
      ),
    ];

    if (codes.length === 0) {
      setBulkError('لم يتم العثور على أرقام كروت صحيحة');
      return;
    }

    setAddingBulk(true);

    try {
      const { error: insertError, data } = await supabase
        .from('cards')
        .insert(
          codes.map((c) => ({
            code: c,
            package_id: bulkPackageId,
          }))
        )
        .select();

      if (insertError) {
        console.error(insertError);

        setBulkError(
          insertError.code === '23505'
            ? 'يوجد كرت مكرر في القائمة أو موجود مسبقًا'
            : 'حدث خطأ أثناء إضافة الكروت'
        );

        return;
      }

      setBulkDone(`تمت إضافة ${data?.length || codes.length} كرت بنجاح`);
      setBulkText('');

      await loadAll();
    } finally {
      setAddingBulk(false);
    }
  }

  async function deleteSingleCard(id) {
    if (!confirm('هل أنت متأكد من حذف هذا الكرت نهائيًا؟')) {
      return;
    }

    setDeletingId(id);

    try {
      const { error: deleteError } = await supabase
        .from('cards')
        .delete()
        .eq('id', id);

      if (deleteError) {
        alert('فشل حذف الكرت: ' + deleteError.message);
        return;
      }

      setSelected((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });

      await loadAll();
    } finally {
      setDeletingId(null);
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) {
      return;
    }

    if (
      !confirm(
        `هل أنت متأكد من حذف ${selected.size} كرت المحددة نهائيًا؟`
      )
    ) {
      return;
    }

    const ids = Array.from(selected);

    const { error: deleteError } = await supabase
      .from('cards')
      .delete()
      .in('id', ids);

    if (deleteError) {
      alert('فشل الحذف الجماعي: ' + deleteError.message);
      return;
    }

    setSelected(new Set());
    await loadAll();
  }

  function clearFilters() {
    setPreviewDate('');
    setPreviewPackageId('');
    setSelected(new Set());
  }

  function formatDate(dateString) {
    if (!dateString) {
      return '—';
    }

    return new Date(dateString).toLocaleDateString('ar-YE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  if (loading) {
    return null;
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="cards-page">
      <style jsx>{`
        .cards-page {
          min-height: 100vh;
          background: var(--bg, #f4f7f6);
          color: var(--text, #111827);
          direction: rtl;
        }

        .main {
          min-height: 100vh;
          padding: 28px;
        }

        .page-header {
          margin-bottom: 24px;
        }

        .page-header h1 {
          margin: 0 0 7px;
          font-size: 27px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }

        .page-header p {
          margin: 0;
          color: #64748b;
          font-size: 14px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 20px;
        }

        .stat-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 17px;
          box-shadow: 0 5px 18px rgba(15, 23, 42, 0.04);
          min-width: 0;
        }

        .stat-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .stat-title {
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
        }

        .stat-value {
          margin-top: 8px;
          font-size: 25px;
          font-weight: 900;
          line-height: 1;
        }

        .stat-icon {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 11px;
          background: #f1f5f9;
          font-size: 17px;
        }

        .panel {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 17px;
          padding: 20px;
          margin-bottom: 18px;
          box-shadow: 0 5px 18px rgba(15, 23, 42, 0.035);
        }

        .panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .panel-head h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 800;
        }

        .muted {
          color: #94a3b8;
          font-size: 12px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 190px auto;
          gap: 12px;
          align-items: end;
        }

        .field {
          min-width: 0;
        }

        .field label {
          display: block;
          margin-bottom: 7px;
          font-size: 12px;
          font-weight: 700;
          color: #475569;
        }

        .input,
        .select,
        .textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #dbe2ea;
          background: #fff;
          color: #111827;
          border-radius: 11px;
          outline: none;
          transition: 0.2s ease;
          font-size: 14px;
        }

        .input,
        .select {
          height: 44px;
          padding: 0 12px;
        }

        .textarea {
          min-height: 125px;
          padding: 12px;
          resize: vertical;
          line-height: 1.8;
        }

        .input:focus,
        .select:focus,
        .textarea:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            monospace;
          direction: ltr;
          text-align: left;
        }

        .btn-primary {
          height: 44px;
          border: 0;
          border-radius: 11px;
          padding: 0 22px;
          background: #2563eb;
          color: white;
          font-weight: 800;
          cursor: pointer;
          transition: 0.2s ease;
          white-space: nowrap;
        }

        .btn-primary:hover {
          background: #1d4ed8;
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .bulk-actions {
          display: flex;
          gap: 12px;
          align-items: end;
          flex-wrap: wrap;
        }

        .bulk-package {
          width: 190px;
        }

        .note {
          border-radius: 11px;
          padding: 11px 13px;
          margin-bottom: 14px;
          font-size: 13px;
          font-weight: 700;
        }

        .error-note {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
        }

        .success-note {
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #047857;
        }

        .filter-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 14px;
        }

        .filters {
          display: grid;
          grid-template-columns: 1fr 190px auto;
          gap: 10px;
          align-items: end;
        }

        .filter-control label {
          display: block;
          margin-bottom: 6px;
          font-size: 11px;
          font-weight: 800;
          color: #64748b;
        }

        .filter-control select,
        .filter-control input {
          width: 100%;
          height: 40px;
          box-sizing: border-box;
          border: 1px solid #dbe2ea;
          border-radius: 9px;
          background: white;
          padding: 0 10px;
        }

        .clear-btn {
          height: 40px;
          padding: 0 16px;
          border: 0;
          border-radius: 9px;
          background: #e2e8f0;
          color: #334155;
          font-weight: 700;
          cursor: pointer;
        }

        .table-wrap {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 720px;
        }

        th {
          background: #f8fafc;
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          padding: 13px 10px;
          border-bottom: 1px solid #e2e8f0;
          text-align: right;
          white-space: nowrap;
        }

        td {
          padding: 13px 10px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 13px;
          vertical-align: middle;
        }

        tbody tr:hover {
          background: #fafafa;
        }

        .code-cell {
          font-weight: 700;
          direction: ltr;
          text-align: right;
          white-space: nowrap;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .status-pill.green {
          background: #dcfce7;
          color: #15803d;
        }

        .status-pill.amber {
          background: #fef3c7;
          color: #b45309;
        }

        .status-pill.red {
          background: #fee2e2;
          color: #b91c1c;
        }

        .delete-btn {
          height: 34px;
          padding: 0 12px;
          border: 0;
          border-radius: 9px;
          background: #fee2e2;
          color: #dc2626;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
        }

        .delete-btn:hover {
          background: #fecaca;
        }

        .delete-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .bulk-delete {
          margin-top: 15px;
          padding: 13px;
          border-radius: 12px;
          background: #fff1f2;
          border: 1px solid #fecdd3;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .bulk-delete-text {
          color: #9f1239;
          font-size: 13px;
          font-weight: 800;
        }

        .bulk-delete-btn {
          border: 0;
          border-radius: 9px;
          background: #dc2626;
          color: white;
          padding: 9px 15px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
        }

        .mobile-list {
          display: none;
        }

        .mobile-card {
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 14px;
          margin-bottom: 10px;
          background: white;
        }

        .mobile-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }

        .mobile-code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            monospace;
          direction: ltr;
          text-align: left;
          font-size: 14px;
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .mobile-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
          margin-bottom: 13px;
        }

        .mobile-info-item {
          background: #f8fafc;
          border-radius: 9px;
          padding: 9px;
          min-width: 0;
        }

        .mobile-info-label {
          display: block;
          color: #94a3b8;
          font-size: 10px;
          margin-bottom: 3px;
        }

        .mobile-info-value {
          font-size: 12px;
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .mobile-delete {
          width: 100%;
          height: 38px;
          border: 0;
          border-radius: 9px;
          background: #fee2e2;
          color: #dc2626;
          font-weight: 800;
          cursor: pointer;
        }

        .empty-state {
          text-align: center;
          padding: 38px 15px;
          color: #94a3b8;
          font-size: 13px;
        }

        .loading-state {
          text-align: center;
          padding: 20px;
          color: #64748b;
          font-size: 12px;
        }

        @media (max-width: 1100px) {
          .main {
            padding: 22px;
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .main {
            padding: 15px;
          }

          .page-header {
            margin-bottom: 17px;
          }

          .page-header h1 {
            font-size: 22px;
          }

          .page-header p {
            font-size: 12px;
            line-height: 1.7;
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 9px;
          }

          .stat-card {
            padding: 13px;
            border-radius: 13px;
          }

          .stat-icon {
            width: 32px;
            height: 32px;
            font-size: 14px;
          }

          .stat-value {
            font-size: 20px;
          }

          .stat-title {
            font-size: 10px;
          }

          .panel {
            padding: 14px;
            border-radius: 14px;
            margin-bottom: 13px;
          }

          .panel-head {
            align-items: flex-start;
            flex-direction: column;
            margin-bottom: 13px;
          }

          .panel-head h3 {
            font-size: 14px;
          }

          .form-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .btn-primary {
            width: 100%;
          }

          .bulk-actions {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .bulk-package {
            width: 100%;
          }

          .filters {
            grid-template-columns: 1fr;
          }

          .clear-btn {
            width: 100%;
          }

          .table-wrap {
            display: none;
          }

          .mobile-list {
            display: block;
          }

          .bulk-delete {
            flex-direction: column;
            align-items: stretch;
          }

          .bulk-delete-btn {
            width: 100%;
          }

          .muted {
            font-size: 11px;
          }
        }

        @media (max-width: 420px) {
          .main {
            padding: 11px;
          }

          .stats-grid {
            gap: 7px;
          }

          .stat-card {
            padding: 11px;
          }

          .stat-value {
            font-size: 18px;
          }

          .mobile-info {
            grid-template-columns: 1fr;
          }

          .panel {
            padding: 12px;
          }
        }
      `}</style>

      <Sidebar
        role="admin"
        active="/admin/cards"
        name={profile.full_name}
      />

      <div className="main">
        <div className="page-header">
          <h1>المخزون والكروت</h1>
          <p>
            إدارة كروت الإنترنت وإضافة الكروت ومراجعة حالتها وحذف الكروت
            غير الصحيحة.
          </p>
        </div>

        {/* الإحصائيات */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-top">
              <div>
                <div className="stat-title">إجمالي الكروت</div>
                <div className="stat-value">{statistics.total}</div>
              </div>
              <div className="stat-icon">🎫</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <div>
                <div className="stat-title">متاح</div>
                <div className="stat-value">
                  {statistics.available}
                </div>
              </div>
              <div className="stat-icon">🟢</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <div>
                <div className="stat-title">مع موزع</div>
                <div className="stat-value">
                  {statistics.withDistributor}
                </div>
              </div>
              <div className="stat-icon">🟠</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <div>
                <div className="stat-title">مباع</div>
                <div className="stat-value">
                  {statistics.sold}
                </div>
              </div>
              <div className="stat-icon">🔴</div>
            </div>
          </div>
        </div>

        {/* إضافة فردية */}
        <div className="panel">
          <div className="panel-head">
            <h3>إضافة كرت يدويًا</h3>
            <span className="muted">
              أضف كرتًا واحدًا إلى المخزون
            </span>
          </div>

          {error && (
            <div className="note error-note">
              {error}
            </div>
          )}

          <form onSubmit={addCard}>
            <div className="form-grid">
              <div className="field">
                <label>رقم الكرت</label>
                <input
                  className="input mono"
                  value={code}
                  onChange={(e) =>
                    setCode(
                      e.target.value.replace(/\D/g, '')
                    )
                  }
                  placeholder="72419038221501"
                  inputMode="numeric"
                />
              </div>

              <div className="field">
                <label>الباقة</label>
                <select
                  className="select"
                  value={packageId}
                  onChange={(e) =>
                    setPackageId(e.target.value)
                  }
                >
                  <option value="">اختر باقة</option>

                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="btn-primary"
                type="submit"
                disabled={addingCard}
              >
                {addingCard ? 'جارٍ الإضافة...' : 'إضافة الكرت'}
              </button>
            </div>
          </form>
        </div>

        {/* إضافة جماعية */}
        <div className="panel">
          <div className="panel-head">
            <h3>إضافة مجموعة كروت</h3>
            <span className="muted">
              رقم كرت واحد في كل سطر
            </span>
          </div>

          {bulkError && (
            <div className="note error-note">
              {bulkError}
            </div>
          )}

          {bulkDone && (
            <div className="note success-note">
              ✓ {bulkDone}
            </div>
          )}

          <form onSubmit={addBulkCards}>
            <textarea
              className="textarea mono"
              value={bulkText}
              onChange={(e) =>
                setBulkText(e.target.value)
              }
              placeholder={
                '72419038221501\n72419038221502\n72419038221503'
              }
            />

            <div
              className="bulk-actions"
              style={{ marginTop: 10 }}
            >
              <div className="field bulk-package">
                <label>الباقة</label>

                <select
                  className="select"
                  value={bulkPackageId}
                  onChange={(e) =>
                    setBulkPackageId(e.target.value)
                  }
                >
                  <option value="">اختر باقة</option>

                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="btn-primary"
                type="submit"
                disabled={addingBulk}
              >
                {addingBulk
                  ? 'جارٍ إضافة الكروت...'
                  : 'إضافة الكل'}
              </button>
            </div>
          </form>
        </div>

        {/* الفلاتر */}
        <div className="panel">
          <div className="panel-head">
            <h3>البحث والتصفية</h3>
            <span className="muted">
              تصفية حسب الباقة والتاريخ
            </span>
          </div>

          <div className="filter-box">
            <div className="filters">
              <div className="filter-control">
                <label>الباقة</label>

                <select
                  value={previewPackageId}
                  onChange={(e) => {
                    setPreviewPackageId(e.target.value);
                    setSelected(new Set());
                  }}
                >
                  <option value="">كل الباقات</option>

                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-control">
                <label>التاريخ</label>

                <input
                  type="date"
                  value={previewDate}
                  onChange={(e) => {
                    setPreviewDate(e.target.value);
                    setSelected(new Set());
                  }}
                />
              </div>

              <button
                className="clear-btn"
                type="button"
                onClick={clearFilters}
              >
                إلغاء التصفية
              </button>
            </div>
          </div>
        </div>

        {/* قائمة الكروت */}
        <div className="panel">
          <div className="panel-head">
            <h3>
              الكروت ({filteredCards.length})
            </h3>

            {loadingData && (
              <span className="muted">
                جارٍ تحديث البيانات...
              </span>
            )}
          </div>

          {/* نسخة الكمبيوتر */}
          <div className="table-wrap">
            {filteredCards.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>
                      <input
                        type="checkbox"
                        checked={
                          selected.size ===
                            filteredCards.length &&
                          filteredCards.length > 0
                        }
                        onChange={toggleAll}
                      />
                    </th>

                    <th>الكود</th>
                    <th>الباقة</th>
                    <th>تاريخ الإضافة</th>
                    <th>الحالة</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCards.map((c) => {
                    const status =
                      statusLabel[c.status] || [
                        c.status || 'غير معروف',
                        'amber',
                      ];

                    return (
                      <tr key={c.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.has(c.id)}
                            onChange={() =>
                              toggle(c.id)
                            }
                          />
                        </td>

                        <td className="code-cell">
                          {c.code}
                        </td>

                        <td>
                          {c.packages?.name || '—'}
                        </td>

                        <td>
                          {formatDate(c.created_at)}
                        </td>

                        <td>
                          <span
                            className={`status-pill ${status[1]}`}
                          >
                            {status[0]}
                          </span>
                        </td>

                        <td>
                          <button
                            className="delete-btn"
                            onClick={() =>
                              deleteSingleCard(c.id)
                            }
                            disabled={
                              deletingId === c.id
                            }
                          >
                            {deletingId === c.id
                              ? 'جارٍ الحذف...'
                              : '🗑 حذف'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                لا توجد كروت مطابقة للتصفية الحالية.
              </div>
            )}
          </div>

          {/* نسخة الهاتف */}
          <div className="mobile-list">
            {filteredCards.length > 0 ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 12,
                    padding: '4px 2px',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={
                      selected.size ===
                        filteredCards.length &&
                      filteredCards.length > 0
                    }
                    onChange={toggleAll}
                  />

                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#64748b',
                    }}
                  >
                    تحديد كل النتائج
                  </span>
                </div>

                {filteredCards.map((c) => {
                  const status =
                    statusLabel[c.status] || [
                      c.status || 'غير معروف',
                      'amber',
                    ];

                  return (
                    <div
                      className="mobile-card"
                      key={c.id}
                    >
                      <div className="mobile-card-top">
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 9,
                            minWidth: 0,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(c.id)}
                            onChange={() =>
                              toggle(c.id)
                            }
                          />

                          <div className="mobile-code">
                            {c.code}
                          </div>
                        </div>

                        <span
                          className={`status-pill ${status[1]}`}
                        >
                          {status[0]}
                        </span>
                      </div>

                      <div className="mobile-info">
                        <div className="mobile-info-item">
                          <span className="mobile-info-label">
                            الباقة
                          </span>

                          <span className="mobile-info-value">
                            {c.packages?.name || '—'}
                          </span>
                        </div>

                        <div className="mobile-info-item">
                          <span className="mobile-info-label">
                            تاريخ الإضافة
                          </span>

                          <span className="mobile-info-value">
                            {formatDate(c.created_at)}
                          </span>
                        </div>
                      </div>

                      <button
                        className="mobile-delete"
                        onClick={() =>
                          deleteSingleCard(c.id)
                        }
                        disabled={
                          deletingId === c.id
                        }
                      >
                        {deletingId === c.id
                          ? 'جارٍ حذف الكرت...'
                          : '🗑 حذف الكرت'}
                      </button>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="empty-state">
                لا توجد كروت مطابقة للتصفية الحالية.
              </div>
            )}
          </div>

          {/* الحذف الجماعي */}
          {selected.size > 0 && (
            <div className="bulk-delete">
              <div className="bulk-delete-text">
                تم تحديد {selected.size} كرت من النتائج الحالية
              </div>

              <button
                className="bulk-delete-btn"
                onClick={deleteSelected}
              >
                🗑 حذف المحدد نهائيًا
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
