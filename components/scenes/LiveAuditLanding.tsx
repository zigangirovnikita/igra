'use client';

import { useState } from 'react';

type AuditImage = {
  src: string;
  alt: string;
};

const hero: AuditImage = {
  src: '/assets/live-audit/hero-online-product.png',
  alt: 'Как лучше всего продавать ваш онлайн-продукт',
};

const cases: AuditImage[] = [
  { src: '/assets/live-audit/case-jobs.png', alt: 'Кейс с ростом подписчиков, кодовыми словами, заявками и автооплатами' },
  { src: '/assets/live-audit/case-numerology.png', alt: 'Кейс с ростом подписчиков и оплатами после внедрения метода' },
  { src: '/assets/live-audit/case-hypno.png', alt: 'Кейс с ростом подписчиков, кодовыми словами и автооплатами практик' },
  { src: '/assets/live-audit/case-china.png', alt: 'Кейс с первыми продажами из воронки' },
  { src: '/assets/live-audit/case-funnel.png', alt: 'Кейс с конверсиями воронки и выручкой' },
];

const reviews: AuditImage[] = [
  { src: '/assets/live-audit/review-01.png', alt: 'Отзыв о разборе ценообразования и модели продаж' },
  { src: '/assets/live-audit/review-02.png', alt: 'Отзыв о построении воронки и офферах' },
  { src: '/assets/live-audit/review-03.png', alt: 'Отзыв о консультации и понимании бизнеса через рассылки' },
  { src: '/assets/live-audit/review-04.png', alt: 'Короткий отзыв о четкой информации' },
  { src: '/assets/live-audit/review-05.png', alt: 'Отзыв о экологичном подходе специалиста' },
  { src: '/assets/live-audit/review-06.png', alt: 'Отзыв о точках роста и пути к ним' },
];

const auditPoints = [
  'Какой источник рекламы подойдет вам лучше всего и 10 референсов для Instagram Reels.',
  'Майнд-карту полной воронки от рекламы до покупки.',
  'Разбор продуктов: что давать бесплатно, что продавать без вашего участия, а что использовать как основной источник прибыли.',
  'Подбор целевой аудитории, которая будет не тратить ваше время, а покупать.',
];

export function LiveAuditLanding({ onLead, onBack }: { onLead: () => void; onBack: () => void }) {
  const [openedImage, setOpenedImage] = useState<AuditImage | null>(null);

  return (
    <div className="scene-screen live-audit scrollable">
      <ImageButton image={hero} className="live-audit-hero" onOpen={setOpenedImage} />

      <section className="live-audit-panel live-audit-intro">
        <h1>Живой разбор вашей воронки</h1>
        <p>Мы уже делали много сильных результатов благодаря связкам из рекламы, прогрева, ботов, контента и понятной продажи.</p>
      </section>

      <section className="live-audit-panel">
        <h2>Кейсы и результаты</h2>
        <p>Нажмите на любую картинку, чтобы рассмотреть подробнее.</p>
        <div className="live-audit-gallery live-audit-gallery--cases">
          {cases.map((image) => <ImageButton key={image.src} image={image} onOpen={setOpenedImage} />)}
        </div>
      </section>

      <section className="live-audit-panel">
        <h2>Отзывы после консультаций</h2>
        <div className="live-audit-gallery live-audit-gallery--reviews">
          {reviews.map((image) => <ImageButton key={image.src} image={image} onOpen={setOpenedImage} />)}
        </div>
      </section>

      <section className="live-audit-panel live-audit-offer">
        <h2>Оставьте заявку на бесплатный разбор вашей воронки</h2>
        <p>На разборе вы получите:</p>
        <ol>
          {auditPoints.map((point) => <li key={point}>{point}</li>)}
        </ol>
      </section>

      <div className="scene-actions live-audit-actions">
        <button className="btn-primary" onClick={onLead}>Оставить заявку</button>
        <button className="btn-secondary" onClick={onBack}>← Назад к итогам</button>
      </div>

      {openedImage && (
        <button className="live-audit-lightbox" type="button" onClick={() => setOpenedImage(null)} aria-label="Закрыть изображение">
          <img src={openedImage.src} alt={openedImage.alt} />
          <span>Нажмите, чтобы закрыть</span>
        </button>
      )}
    </div>
  );
}

function ImageButton({
  image,
  className,
  onOpen,
}: {
  image: AuditImage;
  className?: string;
  onOpen: (image: AuditImage) => void;
}) {
  return (
    <button className={`live-audit-image${className ? ` ${className}` : ''}`} type="button" onClick={() => onOpen(image)}>
      <img src={image.src} alt={image.alt} loading="lazy" />
    </button>
  );
}
