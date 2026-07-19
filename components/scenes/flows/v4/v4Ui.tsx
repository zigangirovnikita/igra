'use client';

import type { ReactNode } from 'react';
import type { V4ProductType } from '@/packages/game-engine/src';

export const PRODUCT_TITLES: Record<V4ProductType, string> = {
  consultation: 'Консультация',
  service: 'Услуга',
  recorded_course: 'Курс в записи',
  live_course: 'Живой курс',
  mentorship: 'Наставничество',
  membership: 'Клуб / подписка',
};

export function rub(value: number): string {
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}

export function V4Screen({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="v4-screen">
      <header className="v4-header">
        <p className="v4-kicker">Собери воронку на мечту</p>
        <h1>{title}</h1>
      </header>
      <div className="v4-body">{children}</div>
      {footer && <footer className="v4-footer">{footer}</footer>}
    </section>
  );
}
