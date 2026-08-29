import '../styles/globals.css';

export const metadata = {
  title: 'تواصل | نظام إدارة وتوزيع الكروت',
  description: 'نظام تواصل لإدارة مخزون الكروت وتوزيعها على الموزعين',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        {/* مقتطف رمز Google AdSense لإثبات ملكية الموقع */}
        <script 
          async 
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9528800147930991" 
          crossOrigin="anonymous">
        </script>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
