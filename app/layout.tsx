import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Проживи 30 дней запуска',
  description: 'Интерактивный симулятор запуска онлайн-продукта'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
