'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/*

* =========================================================
* نظام الإعلانات المركزي — شبكة تواصل
* =========================================================
* 
* يعتمد على جدول:
* public.ads
* 
* الحقول المستخدمة:
* - title
* - image_url
* - link_url
* - placement
* - active
* - created_at
* 
* أماكن الإعلانات:
* - admin
* - distributor
* 
* لا توجد أي صلاحيات خاصة داخل هذا الملف.
* القراءة تتم من خلال Supabase RLS الحالية.
  */

function AdContent({
ad,
compact = false,
title = 'المساحة الإعلانية',
subtitle = '',
}) {
if (!ad) {
return (
<div
className="panel"
style={{
margin: 0,
padding: compact ? '14px 18px' : 18,
}}
>
<div
className="panel-head"
style={{
marginBottom: compact ? 0 : 12,
}}
>
<h3>{title}</h3>

      {subtitle && (
        <span className="muted">
          {subtitle}
        </span>
      )}
    </div>

    <div
      style={{
        border: '1.5px dashed var(--line)',
        borderRadius: 16,
        padding: compact ? 18 : 26,
        textAlign: 'center',
        background: 'var(--surface-2)',
      }}
    >
      <div
        style={{
          fontSize: compact ? 18 : 24,
          marginBottom: 6,
        }}
      >
        📺
      </div>

      <div
        style={{
          fontWeight: 800,
          fontSize: 14,
          marginBottom: 5,
        }}
      >
        مساحة إعلانية
      </div>

      <div
        style={{
          fontSize: 12,
          color: 'var(--ink-soft)',
          lineHeight: 1.8,
        }}
      >
        سيتم عرض الإعلان هنا عند توفر إعلان نشط.
      </div>
    </div>
  </div>
);

}

const content = (
<div
style={{
position: 'relative',
overflow: 'hidden',
borderRadius: 16,
border: '1px solid var(--line)',
background: 'var(--surface-2)',
}}
>
{ad.image_url && (
<img
src={ad.image_url}
alt={ad.title || 'إعلان'}
style={{
display: 'block',
width: '100%',
maxHeight: compact ? 180 : 320,
objectFit: 'cover',
}}
loading="lazy"
onError={(event) => {
event.currentTarget.style.display =
'none';
}}
/>
)}

  <div
    style={{
      padding: compact ? '12px 14px' : '14px 16px',
      background: 'var(--surface)',
    }}
  >
    <div
      style={{
        fontSize: 14,
        fontWeight: 900,
        color: 'var(--ink)',
        marginBottom: ad.image_url ? 4 : 0,
      }}
    >
      {ad.title || 'إعلان'}
    </div>

    {ad.image_url && (
      <div
        style={{
          fontSize: 11.5,
          color: 'var(--ink-soft)',
        }}
      >
        إعلان مدعوم
      </div>
    )}
  </div>
</div>

);

if (ad.link_url) {
return (
<a
href={ad.link_url}
target="_blank"
rel="noopener noreferrer sponsored"
aria-label={ad.title || 'فتح الإعلان'}
style={{
display: 'block',
color: 'inherit',
textDecoration: 'none',
}}
>
{content}
</a>
);
}

return content;
}

function useActiveAd(placement) {
const [ad, setAd] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
let mounted = true;

async function loadAd() {
  setLoading(true);

  try {
    const { data, error } = await supabase
      .from('ads')
      .select(
        'id, title, image_url, link_url, placement, active, created_at'
      )
      .eq('placement', placement)
      .eq('active', true)
      .order('created_at', {
        ascending: false,
      })
      .limit(1);

    if (error) {
      console.error(
        `Error loading ${placement} ad:`,
        error
      );

      if (mounted) {
        setAd(null);
      }

      return;
    }

    if (mounted) {
      setAd(
        Array.isArray(data) &&
          data.length > 0
          ? data[0]
          : null
      );
    }
  } catch (error) {
    console.error(
      `Unexpected ${placement} ad error:`,
      error
    );

    if (mounted) {
      setAd(null);
    }
  } finally {
    if (mounted) {
      setLoading(false);
    }
  }
}

loadAd();

return () => {
  mounted = false;
};

}, [placement]);

return {
ad,
loading,
};
}

/*

* =========================================================
* إعلان المدير
* =========================================================
* 
* يستخدم:
* placement = 'admin'
  */
  export function AdSlotAdmin() {
  const { ad, loading } =
  useActiveAd('admin');

return (
<div
className="panel"
style={{
marginTop: 20,
}}
>
<div
className="panel-head"
style={{
display: 'flex',
justifyContent: 'space-between',
alignItems: 'center',
gap: 10,
flexWrap: 'wrap',
}}
>
<h3>المساحة الإعلانية</h3>

    <span className="muted">
      خاصة بالمدير
    </span>
  </div>

  {loading ? (
    <div
      style={{
        border: '1.5px dashed var(--line)',
        borderRadius: 16,
        padding: 26,
        textAlign: 'center',
        background: 'var(--surface-2)',
        color: 'var(--ink-soft)',
        fontSize: 12.5,
      }}
    >
      جاري تحميل الإعلان...
    </div>
  ) : (
    <AdContent
      ad={ad}
      title="المساحة الإعلانية"
      subtitle="خاصة بالمدير"
    />
  )}
</div>

);
}

/*

* =========================================================
* إعلان الموزع
* =========================================================
* 
* يستخدم:
* placement = 'distributor'
  */
  export function AdSlotBar() {
  const { ad, loading } =
  useActiveAd('distributor');

return (
<div
className="panel"
style={{
padding: '14px 18px',
marginBottom: 20,
}}
>
{loading ? (
<div
style={{
minHeight: 60,
display: 'flex',
alignItems: 'center',
justifyContent: 'center',
color: 'var(--ink-soft)',
fontSize: 12,
}}
>
جاري تحميل الإعلان...
</div>
) : ad ? (
<AdContent
ad={ad}
compact
title="المساحة الإعلانية"
/>
) : (
<div
style={{
display: 'flex',
alignItems: 'center',
justifyContent: 'space-between',
gap: 14,
flexWrap: 'wrap',
}}
>
<div
style={{
display: 'flex',
alignItems: 'center',
gap: 10,
}}
>
<span
style={{
fontSize: 18,
}}
>
📺
</span>

        <span
          style={{
            fontSize: 12,
            color: 'var(--ink-soft)',
            fontWeight: 600,
          }}
        >
          مساحة إعلانية
        </span>
      </div>

      <span
        style={{
          fontSize: 11,
          color: 'var(--ink-soft)',
        }}
      >
        لا يوجد إعلان نشط حاليًا
      </span>
    </div>
  )}
</div>

);
}
