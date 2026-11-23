
export default function manifest() {
  return {
    id: '/',
    name: 'شبكة تواصل',
    short_name: 'تواصل',

    description: 'تطبيق شبكة تواصل لإدارة وتوزيع كروت الإنترنت',

    lang: 'ar',
    dir: 'rtl',

    start_url: '/',
    scope: '/',

    display: 'standalone',
    orientation: 'portrait',

    background_color: '#FFFFFF',
    theme_color: '#16A34A',

    categories: ['business', 'utilities'],

    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      }
    ]
  };
}
