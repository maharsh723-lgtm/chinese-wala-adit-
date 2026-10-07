import '../style.css';

export const metadata = {
  title: 'Chinese Wala ADIT Campus - Luxury POS & Operations Engine',
  description: 'Enterprise POS, Inventory, HR & Operations Suite',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" />
        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js" async></script>
        <script src="https://unpkg.com/lucide@latest" async></script>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
