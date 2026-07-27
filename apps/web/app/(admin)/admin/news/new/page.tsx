import { NewsForm } from '@/components/admin/news-form';

/** Create-News screen (Design D13, PRD A10). */
export default function NewNewsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-fg">ข่าวใหม่ / New post</h1>
      <NewsForm />
    </div>
  );
}
