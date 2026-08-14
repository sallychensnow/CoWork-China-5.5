import type { Metadata } from 'next';
import './globals.css';
import ClientLayout from '@/components/ClientLayout';

export const metadata: Metadata = {
  title: 'Snowflake China Cowork V5',
  description: 'AI Agent Platform - Snowflake China',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="font-sans antialiased flex h-screen overflow-hidden bg-bg-primary text-text-primary">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
