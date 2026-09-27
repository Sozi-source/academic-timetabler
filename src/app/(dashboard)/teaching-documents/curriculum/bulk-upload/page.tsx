import { requireHodAccess } from '@/features/auth/authorization';
import { BulkUploadView } from '@/features/teaching-documents/bulk-upload-view';

export default async function BulkUploadPage() {
  await requireHodAccess();

  return <BulkUploadView />;
}
