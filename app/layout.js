
import '../styles/globals.css';

export const metadata = {
  title: 'تواصل | نظام إدارة وتوزيع الكروت',
  description: 'نظام تواصل لإدارة مخزون الكروت وتوزيعها على الموزعين',
  applicationName: 'شبكة تواصل',
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
