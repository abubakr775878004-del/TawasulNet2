'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function Sidebar({ role, active, name }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

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
      <button className="menu-toggle" onClick={() => setOpen(true)} aria-label="فتح القائمة">
        <span></span><span></span><span></span>
      </button>

      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}

      <div className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <button className="sidebar-close" onClick={() => setOpen(false)} aria-label="إغلاق القائمة">✕</button>

        <div className="brand">تواصل</div>
        <div style={{ fontSize: 12, color: '#9186B8', marginBottom: 26 }}>
          {role === 'admin' ? 'لوحة المدير' : 'لوحة الموزع'}
        </div>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`navitem ${active === l.href ? 'on' : ''}`}
            onClick={() => setOpen(false)}
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
    </>
  );
}
