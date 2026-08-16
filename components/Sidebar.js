'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function Sidebar({ role, active, name }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const adminLinks = [
    { href: '/admin', label: 'الرئيسية' },
    { href: '/admin/cards', label: 'المخزون والكروت' },
    { href: '/admin/cards/import', label: 'استيراد PDF' },
    { href: '/admin/packages', label: 'الباقات' },
    { href: '/admin/requests', label: 'طلبات الموزعين' },
    { href: '/admin/distributors', label: 'الموزعون' },
  ];

  const distLinks = [
    { href: '/distributor', label: 'الرئيسية' },
    { href: '/distributor/request', label: 'طلب كروت جديد' },
    { href: '/distributor/sales', label: 'مبيعاتي (٢٤ ساعة)' },
  ];

  const links = role === 'admin' ? adminLinks : distLinks;

  async function logout() {
    await supabase.auth.signOut();
    router.push('/');
  }

  return (
    <>
      {/* شريط علوي مرتب للهواتف فقط لكي لا يتداخل مع أي نص أو عنوان */}
      <div className="mobile-top-bar">
        <div className="mobile-brand-title">تواصل</div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="mobile-menu-btn-pro"
          aria-label="القائمة"
        >
          {isOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* خلفية معتمة عند فتح القائمة */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(28, 21, 51, 0.4)',
            backdropFilter: 'blur(3px)',
            zIndex: 998,
          }}
        />
      )}

      {/* القائمة الجانبية */}
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="brand">تواصل</div>
        <div style={{ fontSize: 12, color: '#9186B8', marginBottom: 26 }}>
          {role === 'admin' ? 'لوحة المدير' : 'لوحة الموزع'}
        </div>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => setIsOpen(false)}
            className={`navitem ${active === l.href ? 'on' : ''}`}
          >
            {l.label}
          </Link>
        ))}
        <div style={{ marginTop: 'auto', paddingTop: 40 }}>
          <div style={{ fontSize: 12, color: '#9186B8', marginBottom: 10 }}>
            متصل كـ <b style={{ color: '#fff' }}>{name}</b>
          </div>
          <button onClick={logout} className="btn-logout">تسجيل الخروج</button>
        </div>
      </div>

      <style jsx global>{`
        .mobile-top-bar {
          display: none;
        }

        @media (max-width: 768px) {
          .mobile-top-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: #ffffff;
            padding: 12px 20px;
            position: sticky;
            top: 0;
            z-index: 997;
            border-bottom: 1px solid #E6E0F7;
            box-shadow: 0 4px 12px rgba(28, 21, 51, 0.04);
          }

          .mobile-brand-title {
            font-weight: 900;
            font-size: 18px;
            color: #5B21B6;
          }

          .mobile-menu-btn-pro {
            background: #5B21B6;
            color: #fff;
            border: none;
            border-radius: 10px;
            width: 40px;
            height: 40px;
            font-size: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 4px 10px rgba(91, 33, 182, 0.2);
          }

          .sidebar {
            position: fixed !important;
            right: 0 !important;
            left: auto !important;
            top: 0 !important;
            bottom: 0 !important;
            width: 270px !important;
            transform: translateX(100%);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 999;
          }
          
          .sidebar.open {
            transform: translateX(0) !important;
          }
        }
      `}</style>
    </>
  );
}
