
import '../styles/globals.css';

export const metadata = {
  title: 'تواصل | نظام إدارة وتوزيع الكروت',
  description: 'نظام تواصل لإدارة مخزون الكروت وتوزيعها على الموزعين',
  applicationName: 'شبكة تواصل',

  icons: {
    icon: [
      {
        url: '/icons/favicon-32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        url: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    shortcut: '/icons/favicon-32.png',
    apple: [
      {
        url: '/icons/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0F766E',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        {children}
      </body>
    </html>
  );
}
