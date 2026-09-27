import { redirect } from 'next/navigation';

interface PageProps {
  searchParams?: Promise<{
    unitId?: string;
    unitCode?: string;
    documentType?: string | string[];
  }>;
}

export default async function OnlineEditorRedirectPage({ searchParams }: PageProps) {
  const resolvedParams = searchParams ? (await searchParams) ?? {} : {};
  const query = new URLSearchParams();

  if (resolvedParams.unitId) {
    query.set('unitId', resolvedParams.unitId);
  }
  if (resolvedParams.unitCode) {
    query.set('unitCode', resolvedParams.unitCode);
  }
  if (resolvedParams.documentType) {
    const docType = Array.isArray(resolvedParams.documentType)
      ? resolvedParams.documentType[0]
      : resolvedParams.documentType;
    if (docType) query.set('documentType', docType);
  }

  const queryString = query.toString();
  redirect(
    `/teaching-documents/curriculum/individual-upload${queryString ? `?${queryString}` : ''}`
  );
}
