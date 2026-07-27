import { PromotionForm } from '@/components/admin/promotion-form';

/** Create-Promotion screen (Design D11, PRD A6.1). */
export default function NewPromotionPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-fg">โปรโมชั่นใหม่ / New promotion</h1>
      <PromotionForm />
    </div>
  );
}
