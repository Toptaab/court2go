import { BranchForm } from '@/components/admin/branch-form';

/** Create-Branch screen (Design D9, PRD A4.1). */
export default function NewBranchPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-fg">สาขาใหม่ / New branch</h1>
      <BranchForm />
    </div>
  );
}
