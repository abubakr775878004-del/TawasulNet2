import '../styles/globals.css';

export const metadata = {
  title: 'تواصل | نظام إدارة وتوزيع الكروت',
  description: 'نظام تواصل لإدارة مخزون الكروت وتوزيعها على الموزعين',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
