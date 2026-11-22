
import '../styles/globals.css';
import PWARegister from '../components/PWARegister';

export const metadata = {
  title: 'تواصل | نظام إدارة وتوزيع الكروت',
  description: 'نظام تواصل لإدارة مخزون الكروت وتوزيعها على الموزعين',
  applicationName: 'شبكة تواصل',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'تواصل',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
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
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
