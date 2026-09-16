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

const statusOptions = [
  { value: '', label: 'كل الحالات' },
  { value: 'available', label: 'متاح' },
  { value: 'with_distributor', label: 'مع موزع' },
  { value: 'sold', label: 'مباع' },
];

export default function CardsPage() {
  const { profile, loading } = useProfile('admin');

  const [packages, setPackages] = useState([]);
  const [cards, setCards] = useState([]);
  const [selected, setSelected] = useState(new Set());

  const [searchCode, setSearchCode] = useState('');
  const [previewDate, setPreviewDate] = useState('');
  const [previewPackageId, setPreviewPackageId] = useState('');
  const [previewStatus, setPreviewStatus] = useState('');

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
      const [
        { data: pkgs, error: packagesError },
        { data: crds, error: cardsError },
      ] = await Promise.all([
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
    const normalizedSearch = searchCode.trim().toLowerCase();

    return cards.filter((c) => {
      const cardDate = c.created_at
        ? c.created_at.split('T')[0]
        : '';

      const cardCode = String(c.code || '').toLowerCase();

      const matchSearch =
        !normalizedSearch ||
        cardCode.includes(normalizedSearch);

      const matchDate =
        !previewDate || cardDate === previewDate;

      const matchPackage =
        !previewPackageId ||
        c.package_id === previewPackageId;

      const matchStatus =
        !previewStatus ||
        c.status === previewStatus;

      return (
        matchSearch &&
        matchDate &&
        matchPackage &&
        matchStatus
      );
    });
  }, [
    cards,
    searchCode,
    previewDate,
    previewPackageId,
    previewStatus,
  ]);

  const statistics = useMemo(() => {
    return {
      total: cards.length,
      available: cards.filter(
        (c) => c.status === 'available'
      ).length,
      withDistributor: cards.filter(
        (c) => c.status === 'with_distributor'
      ).length,
      sold: cards.filter(
        (c) => c.status === 'sold'
      ).length,
    };
  }, [cards]);

  function toggleAll() {
    if (
      selected.size === filteredCards.length &&
      filteredCards.length > 0
    ) {
      setSelected(new Set());
    } else {
      setSelected(
        new Set(filteredCards.map((c) => c.id))
      );
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
      const { error: insertError } =
        await supabase
          .from('cards')
          .insert({
            code,
            package_id: packageId,
          });

      if (insertError) {
        console.error(insertError);

        if (insertError.code === '23505') {
          setError('هذا الكرت موجود مسبقًا');
        } else {
          setError('تعذّرت إضافة الكرت');
        }

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
      setBulkError('اختر الباقة أولًا');
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
      setBulkError(
        'لم يتم العثور على أرقام كروت صحيحة'
      );
      return;
    }

    setAddingBulk(true);

    try {
      const {
        error: insertError,
        data,
      } = await supabase
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

        if (insertError.code === '23505') {
          setBulkError(
            'يوجد كرت مكرر أو كرت موجود مسبقًا'
          );
        } else {
          setBulkError(
            'حدث خطأ أثناء إضافة الكروت'
          );
        }

        return;
      }

      setBulkDone(
        `تمت إضافة ${data?.length || codes.length} كرت بنجاح`
      );

      setBulkText('');

      await loadAll();
    } finally {
      setAddingBulk(false);
    }
  }

  async function deleteSingleCard(id) {
    if (
      !confirm(
        'هل أنت متأكد من حذف هذا الكرت نهائيًا؟'
      )
    ) {
      return;
    }

    setDeletingId(id);

    try {
      const { error: deleteError } =
        await supabase
          .from('cards')
          .delete()
          .eq('id', id);

      if (deleteError) {
        alert(
          'فشل حذف الكرت: ' +
            deleteError.message
        );
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

    const { error: deleteError } =
      await supabase
        .from('cards')
        .delete()
        .in('id', ids);

    if (deleteError) {
      alert(
        'فشل الحذف الجماعي: ' +
          deleteError.message
      );
      return;
    }

    setSelected(new Set());

    await loadAll();
  }

  function clearFilters() {
    setSearchCode('');
    setPreviewDate('');
    setPreviewPackageId('');
    setPreviewStatus('');
    setSelected(new Set());
  }

  function formatDate(dateString) {
    if (!dateString) {
      return '—';
    }

    return new Date(
      dateString
    ).toLocaleDateString('ar-YE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  const hasFilters =
    searchCode ||
    previewDate ||
    previewPackageId ||
    previewStatus;

  if (loading || !profile) {
    return null;
  }

  return (
    <div className="cards-page">
      <style jsx global>{`
        .cards-page {
          min-height: 100vh;
          width: 100%;
          background:
            linear-gradient(
              180deg,
              #f0fdf9 0%,
              #f4f7f6 220px,
              #f4f7f6 100%
            );
          color: #111827;
          direction: rtl;
          overflow-x: hidden;
          box-sizing: border-box;
        }

        .cards-page .sidebar {
          position: fixed !important;
          top: 0 !important;
          right: 0 !important;
          left: auto !important;
          bottom: 0 !important;
          width: 270px !important;
          height: 100vh !important;
          z-index: 1000 !important;
          display: flex !important;
          flex-direction: column !important;
          box-sizing: border-box !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
        }

        .cards-page .main {
          min-height: 100vh;
          width: calc(100% - 270px);
          margin-right: 270px;
          padding: 28px;
          box-sizing: border-box;
          overflow-x: hidden;
        }

        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
        }

        .page-header h1 {
          margin: 0 0 7px;
          font-size: 28px;
          font-weight: 950;
          color: #0f172a;
          line-height: 1.3;
        }

        .page-header p {
          margin: 0;
          color: #64748b;
          font-size: 14px;
          line-height: 1.8;
        }

        .header-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 9px 13px;
          border-radius: 999px;
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #047857;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(
            4,
            minmax(0, 1fr)
          );
          gap: 14px;
          margin-bottom: 20px;
        }

        .stat-card {
          position: relative;
          min-width: 0;
          overflow: hidden;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 17px;
          padding: 18px;
          box-shadow:
            0 7px 22px rgba(15, 23, 42, 0.05);
          box-sizing: border-box;
        }

        .stat-card::before {
          content: '';
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          background: #2563eb;
        }

        .stat-card.total::before {
          background: #2563eb;
        }

        .stat-card.available::before {
          background: #16a34a;
        }

        .stat-card.distributor::before {
          background: #f59e0b;
        }

        .stat-card.sold::before {
          background: #dc2626;
        }

        .stat-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .stat-title {
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
        }

        .stat-value {
          margin-top: 8px;
          font-size: 27px;
          font-weight: 950;
          line-height: 1.1;
          color: #0f172a;
        }

        .stat-card.total .stat-value {
          color: #2563eb;
        }

        .stat-card.available .stat-value {
          color: #15803d;
        }

        .stat-card.distributor .stat-value {
          color: #c2410c;
        }

        .stat-card.sold .stat-value {
          color: #dc2626;
        }

        .stat-icon {
          width: 42px;
          height: 42px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          font-size: 18px;
        }

        .stat-card.total .stat-icon {
          background: #dbeafe;
        }

        .stat-card.available .stat-icon {
          background: #dcfce7;
        }

        .stat-card.distributor .stat-icon {
          background: #ffedd5;
        }

        .stat-card.sold .stat-icon {
          background: #fee2e2;
        }

        .panel {
          width: 100%;
          box-sizing: border-box;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 17px;
          padding: 20px;
          margin-bottom: 18px;
          box-shadow:
            0 6px 20px rgba(15, 23, 42, 0.035);
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
          font-weight: 950;
          color: #0f172a;
        }

        .muted {
          color: #94a3b8;
          font-size: 12px;
        }

        .section-marker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .section-marker-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #2563eb;
        }

        .form-grid {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            190px
            auto;
          gap: 12px;
          align-items: end;
        }

        .field {
          min-width: 0;
        }

        .field label {
          display: block;
          margin-bottom: 7px;
          color: #475569;
          font-size: 12px;
          font-weight: 850;
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
          font-size: 14px;
          transition: 0.2s;
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
          box-shadow:
            0 0 0 3px
              rgba(37, 99, 235, 0.1);
        }

        .mono {
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            Monaco,
            Consolas,
            monospace;
          direction: ltr;
          text-align: left;
        }

        .btn-primary {
          height: 44px;
          border: 0;
          border-radius: 11px;
          padding: 0 22px;
          background:
            linear-gradient(
              135deg,
              #2563eb,
              #1d4ed8
            );
          color: white;
          font-weight: 900;
          cursor: pointer;
          white-space: nowrap;
          transition:
            transform 0.15s,
            box-shadow 0.15s,
            background 0.15s;
          box-shadow:
            0 5px 13px
              rgba(37, 99, 235, 0.18);
        }

        .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow:
            0 7px 17px
              rgba(37, 99, 235, 0.23);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .note {
          border-radius: 11px;
          padding: 11px 13px;
          margin-bottom: 14px;
          font-size: 13px;
          font-weight: 800;
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
          background:
            linear-gradient(
              135deg,
              #f8fafc,
              #f0fdf9
            );
          border: 1px solid #dbeafe;
          border-radius: 14px;
          padding: 14px;
        }

        .filters {
          display: grid;
          grid-template-columns:
            minmax(0, 1.5fr)
            minmax(150px, 1fr)
            minmax(150px, 1fr)
            auto;
          gap: 10px;
          align-items: end;
        }

        .filter-control {
          min-width: 0;
        }

        .filter-control label {
          display: block;
          margin-bottom: 6px;
          color: #64748b;
          font-size: 11px;
          font-weight: 900;
        }

        .filter-control input,
        .filter-control select {
          width: 100%;
          height: 40px;
          box-sizing: border-box;
          border: 1px solid #dbe2ea;
          border-radius: 9px;
          background: white;
          padding: 0 10px;
          color: #334155;
          outline: none;
        }

        .filter-control input:focus,
        .filter-control select:focus {
          border-color: #2563eb;
          box-shadow:
            0 0 0 3px
              rgba(37, 99, 235, 0.08);
        }

        .clear-btn {
          height: 40px;
          padding: 0 16px;
          border: 0;
          border-radius: 9px;
          background: #e2e8f0;
          color: #334155;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
        }

        .clear-btn:hover {
          background: #cbd5e1;
        }

        .results-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 14px;
          padding: 10px 12px;
          border-radius: 10px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }

        .results-count {
          color: #334155;
          font-size: 12px;
          font-weight: 900;
        }

        .results-count strong {
          color: #2563eb;
          font-size: 14px;
        }

        .active-filters {
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
        }

        .table-wrap {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          min-width: 780px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
          border-radius: 13px;
        }

        th {
          background: #f1f5f9;
          color: #475569;
          font-size: 11px;
          font-weight: 950;
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
          background: #fff;
        }

        tbody tr:last-child td {
          border-bottom: 0;
        }

        tbody tr:hover td {
          background: #f8fafc;
        }

        .code-cell {
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            Monaco,
            Consolas,
            monospace;
          font-weight: 900;
          color: #1d4ed8;
          direction: ltr;
          text-align: right;
          white-space: nowrap;
        }

        .package-cell {
          color: #334155;
          font-weight: 800;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          border-radius: 999px;
          padding: 6px 11px;
          font-size: 11px;
          font-weight: 950;
          white-space: nowrap;
        }

        .status-pill.green {
          background: #dcfce7;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }

        .status-pill.amber {
          background: #ffedd5;
          color: #c2410c;
          border: 1px solid #fed7aa;
        }

        .status-pill.red {
          background: #fee2e2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }

        .delete-btn {
          height: 34px;
          padding: 0 12px;
          border: 0;
          border-radius: 9px;
          background: #fee2e2;
          color: #dc2626;
          font-size: 12px;
          font-weight: 900;
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
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-top: 15px;
          padding: 13px;
          border-radius: 12px;
          background: #fff1f2;
          border: 1px solid #fecdd3;
        }

        .bulk-delete-text {
          color: #9f1239;
          font-size: 13px;
          font-weight: 900;
        }

        .bulk-delete-btn {
          border: 0;
          border-radius: 9px;
          background: #dc2626;
          color: white;
          padding: 9px 15px;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
          white-space: nowrap;
        }

        .bulk-delete-btn:hover {
          background: #b91c1c;
        }

        .mobile-list {
          display: none;
        }

        .mobile-card {
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 14px;
          margin-bottom: 10px;
          background: #fff;
          box-shadow:
            0 3px 10px
              rgba(15, 23, 42, 0.035);
        }

        .mobile-card.available {
          border-right: 4px solid #16a34a;
        }

        .mobile-card.with-distributor {
          border-right: 4px solid #f59e0b;
        }

        .mobile-card.sold {
          border-right: 4px solid #dc2626;
        }

        .mobile-card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }

        .mobile-code {
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            Monaco,
            Consolas,
            monospace;
          direction: ltr;
          text-align: left;
          color: #1d4ed8;
          font-size: 14px;
          font-weight: 950;
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
          font-weight: 900;
          color: #334155;
          overflow-wrap: anywhere;
        }

        .mobile-delete {
          width: 100%;
          height: 38px;
          border: 0;
          border-radius: 9px;
          background: #fee2e2;
          color: #dc2626;
          font-weight: 900;
          cursor: pointer;
        }

        .mobile-delete:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .empty-state {
          padding: 45px 15px;
          text-align: center;
          color: #94a3b8;
          font-size: 13px;
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          border-radius: 13px;
        }

        .empty-icon {
          font-size: 28px;
          margin-bottom: 7px;
        }

        @media (max-width: 1100px) {
          .cards-page .main {
            padding: 22px;
          }

          .stats-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .filters {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .form-grid {
            grid-template-columns:
              minmax(0, 1fr)
              180px
              auto;
          }
        }

        @media (max-width: 768px) {
          .cards-page .sidebar {
            width: 270px !important;
            height: 100vh !important;
            right: 0 !important;
            left: auto !important;
            top: 0 !important;
            bottom: 0 !important;
            transform: translateX(100%);
            transition:
              transform
              0.3s
              cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 999 !important;
          }

          .cards-page .sidebar.open {
            transform: translateX(0) !important;
          }

          .cards-page .main {
            width: 100%;
            margin-right: 0;
            padding: 15px;
            box-sizing: border-box;
          }

          .page-header {
            margin-bottom: 17px;
          }

          .page-header h1 {
            font-size: 23px;
          }

          .page-header p {
            font-size: 12px;
            line-height: 1.7;
          }

          .header-badge {
            display: none;
          }

          .stats-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
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
            font-size: 21px;
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

          .filters {
            grid-template-columns: 1fr;
          }

          .clear-btn {
            width: 100%;
          }

          .results-bar {
            align-items: flex-start;
            flex-direction: column;
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
        }

        @media (max-width: 420px) {
          .cards-page .main {
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

      <main className="main">
        <header className="page-header">
          <div>
            <h1>المخزون والكروت</h1>

            <p>
              إدارة الكروت والمخزون ومتابعة حالة كل كرت
              بسهولة.
            </p>
          </div>

          <div className="header-badge">
            <span>●</span>
            إدارة المخزون
          </div>
        </header>

        {/* الإحصائيات */}
        <section className="stats-grid">
          <div className="stat-card total">
            <div className="stat-top">
              <div>
                <div className="stat-title">
                  إجمالي الكروت
                </div>

                <div className="stat-value">
                  {statistics.total}
                </div>
              </div>

              <div className="stat-icon">
                🎫
              </div>
            </div>
          </div>

          <div className="stat-card available">
            <div className="stat-top">
              <div>
                <div className="stat-title">
                  الكروت المتاحة
                </div>

                <div className="stat-value">
                  {statistics.available}
                </div>
              </div>

              <div className="stat-icon">
                🟢
              </div>
            </div>
          </div>

          <div className="stat-card distributor">
            <div className="stat-top">
              <div>
                <div className="stat-title">
                  مع موزع
                </div>

                <div className="stat-value">
                  {statistics.withDistributor}
                </div>
              </div>

              <div className="stat-icon">
                🟠
              </div>
            </div>
          </div>

          <div className="stat-card sold">
            <div className="stat-top">
              <div>
                <div className="stat-title">
                  الكروت المباعة
                </div>

                <div className="stat-value">
                  {statistics.sold}
                </div>
              </div>

              <div className="stat-icon">
                🔴
              </div>
            </div>
          </div>
        </section>

        {/* إضافة كرت واحد */}
        <section className="panel">
          <div className="panel-head">
            <div className="section-marker">
              <span className="section-marker-dot" />
              <h3>إضافة كرت إلى المخزون</h3>
            </div>

            <span className="muted">
              إضافة كرت واحد
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
                      e.target.value.replace(
                        /\D/g,
                        ''
                      )
                    )
                  }
                  placeholder="72419038221501"
                  inputMode="numeric"
                />
              </div>

              <div className="field">
                <label>الباقة المرتبطة بالكرت</label>

                <select
                  className="select"
                  value={packageId}
                  onChange={(e) =>
                    setPackageId(
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    اختر باقة
                  </option>

                  {packages.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                    >
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
                {addingCard
                  ? 'جارٍ الإضافة...'
                  : '➕ إضافة الكرت'}
              </button>
            </div>
          </form>
        </section>

        {/* إضافة جماعية */}
        <section className="panel">
          <div className="panel-head">
            <div className="section-marker">
              <span className="section-marker-dot" />
              <h3>إضافة مجموعة كروت</h3>
            </div>

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
              className="form-grid"
              style={{
                marginTop: 10,
                gridTemplateColumns:
                  '190px auto',
              }}
            >
              <div className="field">
                <label>
                  الباقة المرتبطة بالكروت
                </label>

                <select
                  className="select"
                  value={bulkPackageId}
                  onChange={(e) =>
                    setBulkPackageId(
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    اختر باقة
                  </option>

                  {packages.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                    >
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
                  : '➕ إضافة الكل'}
              </button>
            </div>
          </form>
        </section>

        {/* البحث والتصفية */}
        <section className="panel">
          <div className="panel-head">
            <div className="section-marker">
              <span
                className="section-marker-dot"
                style={{
                  background: '#16a34a',
                }}
              />

              <h3>البحث والتصفية</h3>
            </div>

            <span className="muted">
              البحث داخل المخزون المعروض
            </span>
          </div>

          <div className="filter-box">
            <div className="filters">
              <div className="filter-control">
                <label>
                  🔎 البحث برقم الكرت
                </label>

                <input
                  type="text"
                  value={searchCode}
                  onChange={(e) => {
                    setSearchCode(
                      e.target.value
                    );
                    setSelected(new Set());
                  }}
                  placeholder="اكتب رقم الكرت..."
                  inputMode="numeric"
                />
              </div>

              <div className="filter-control">
                <label>الحالة</label>

                <select
                  value={previewStatus}
                  onChange={(e) => {
                    setPreviewStatus(
                      e.target.value
                    );
                    setSelected(new Set());
                  }}
                >
                  {statusOptions.map(
                    (option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="filter-control">
                <label>الباقة</label>

                <select
                  value={previewPackageId}
                  onChange={(e) => {
                    setPreviewPackageId(
                      e.target.value
                    );
                    setSelected(new Set());
                  }}
                >
                  <option value="">
                    كل الباقات
                  </option>

                  {packages.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                    >
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
                    setPreviewDate(
                      e.target.value
                    );
                    setSelected(new Set());
                  }}
                />
              </div>
            </div>

            {hasFilters && (
              <button
                className="clear-btn"
                type="button"
                onClick={clearFilters}
                style={{
                  marginTop: 10,
                  width: '100%',
                }}
              >
                إلغاء جميع التصفية
              </button>
            )}
          </div>
        </section>

        {/* قائمة الكروت */}
        <section className="panel">
          <div className="panel-head">
            <div className="section-marker">
              <span
                className="section-marker-dot"
                style={{
                  background: '#f59e0b',
                }}
              />

              <h3>مخزون الكروت</h3>
            </div>

            {loadingData && (
              <span className="muted">
                جارٍ تحديث المخزون...
              </span>
            )}
          </div>

          <div className="results-bar">
            <div className="results-count">
              عدد النتائج:
              {' '}
              <strong>
                {filteredCards.length}
              </strong>
            </div>

            <div className="active-filters">
              {hasFilters
                ? 'يتم عرض النتائج حسب التصفية المحددة'
                : 'جميع الكروت الظاهرة'}
            </div>
          </div>

          {/* الكمبيوتر */}
          <div className="table-wrap">
            {filteredCards.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>
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

                    <th>رقم الكرت</th>
                    <th>الباقة</th>
                    <th>تاريخ الإضافة</th>
                    <th>الحالة</th>
                    <th>الإجراء</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCards.map((c) => {
                    const status =
                      statusLabel[c.status] || [
                        c.status ||
                          'غير معروف',
                        'amber',
                      ];

                    return (
                      <tr key={c.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.has(
                              c.id
                            )}
                            onChange={() =>
                              toggle(c.id)
                            }
                          />
                        </td>

                        <td className="code-cell">
                          {c.code}
                        </td>

                        <td className="package-cell">
                          {c.packages?.name ||
                            '—'}
                        </td>

                        <td>
                          {formatDate(
                            c.created_at
                          )}
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
                              deleteSingleCard(
                                c.id
                              )
                            }
                            disabled={
                              deletingId ===
                              c.id
                            }
                          >
                            {deletingId ===
                            c.id
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
                <div className="empty-icon">
                  🎫
                </div>

                لا توجد كروت مطابقة
                للتصفية الحالية.
              </div>
            )}
          </div>

          {/* الهاتف */}
          <div className="mobile-list">
            {filteredCards.length > 0 ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 12,
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
                      fontWeight: 800,
                      color: '#64748b',
                    }}
                  >
                    تحديد كل الكروت الظاهرة
                  </span>
                </div>

                {filteredCards.map((c) => {
                  const status =
                    statusLabel[c.status] || [
                      c.status ||
                        'غير معروف',
                      'amber',
                    ];

                  const cardTypeClass =
                    c.status === 'available'
                      ? 'available'
                      : c.status ===
                        'with_distributor'
                      ? 'with-distributor'
                      : c.status === 'sold'
                      ? 'sold'
                      : '';

                  return (
                    <div
                      className={`mobile-card ${cardTypeClass}`}
                      key={c.id}
                    >
                      <div className="mobile-card-top">
                        <div
                          style={{
                            display: 'flex',
                            alignItems:
                              'center',
                            gap: 9,
                            minWidth: 0,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(
                              c.id
                            )}
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
                            {c.packages?.name ||
                              '—'}
                          </span>
                        </div>

                        <div className="mobile-info-item">
                          <span className="mobile-info-label">
                            تاريخ الإضافة
                          </span>

                          <span className="mobile-info-value">
                            {formatDate(
                              c.created_at
                            )}
                          </span>
                        </div>
                      </div>

                      <button
                        className="mobile-delete"
                        onClick={() =>
                          deleteSingleCard(
                            c.id
                          )
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
                <div className="empty-icon">
                  🎫
                </div>

                لا توجد كروت مطابقة
                للتصفية الحالية.
              </div>
            )}
          </div>

          {/* الحذف الجماعي */}
          {selected.size > 0 && (
            <div className="bulk-delete">
              <div className="bulk-delete-text">
                تم تحديد {selected.size} كرت
                من النتائج الحالية
              </div>

              <button
                className="bulk-delete-btn"
                onClick={deleteSelected}
              >
                🗑 حذف المحدد نهائيًا
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
