'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import type { LectureMaterial } from '../types';
import { MaterialList, MaterialUploadForm } from './material-upload-form';
import { GenerationPanel } from './generation-panel';

interface Material {
  id: string;
  title: string;
  source_type: string;
  source_url: string | null;
  original_filename: string | null;
  chunk_count: number;
  ingested_at: string | null;
  processing_error?: string | null;
  created_at: string;
}

interface LectureNotesWorkspaceProps {
  unitId: string;
  unitCode: string;
  unitName: string;
  teachingAllocationId?: string | null;
  initialMaterials: LectureMaterial[];
  topics: string[];
}

export function LectureNotesWorkspace({
  unitId,
  unitCode,
  unitName,
  teachingAllocationId,
  initialMaterials,
  topics,
}: LectureNotesWorkspaceProps) {
  const [materials, setMaterials] = useState<Material[]>(
    initialMaterials.map((m) => ({
      id: m.id,
      title: m.title,
      source_type: m.sourceType,
      source_url: m.sourceUrl,
      original_filename: m.originalFilename,
      chunk_count: m.chunkCount,
      ingested_at: m.ingestedAt,
      processing_error: (m as unknown as { processing_error?: string | null }).processing_error ?? m.processingError ?? null,
      created_at: m.createdAt,
    })),
  );

  const hasProcessingMaterials = materials.some((m) => !m.ingested_at && !m.processing_error);

  useEffect(() => {
    if (!hasProcessingMaterials) return;

    let cancelled = false;

    const refreshMaterials = async () => {
      try {
        const response = await fetch(`/api/lecture-notes/materials?unitId=${encodeURIComponent(unitId)}`, {
          cache: 'no-store',
        });
        if (!response.ok || cancelled) return;

        const json = await response.json() as { materials?: Material[] };
        if (json.materials) setMaterials(json.materials);
      } catch {
        // Background status polling is intentionally silent.
      }
    };

    void refreshMaterials();
    const timer = window.setInterval(() => void refreshMaterials(), 4000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [hasProcessingMaterials, unitId]);

  function handleMaterialAdded(material: Material) {
    setMaterials((prev) => [material, ...prev.filter((item) => item.id !== material.id)]);
  }

  function handleMaterialDeleted(id: string) {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  }

  const ingestedCount = materials.filter((m) => m.ingested_at != null).length;
  const activeProcessingCount = materials.filter((m) => !m.ingested_at && !m.processing_error).length;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <MaterialUploadForm
        unitId={unitId}
        teachingAllocationId={teachingAllocationId}
        onMaterialAdded={handleMaterialAdded}
      />

      {materials.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
              Source library
            </p>
            {hasProcessingMaterials ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] text-text-muted">
                <LoaderCircle className="size-3 animate-spin" />
                Indexing
              </span>
            ) : null}
          </div>
          <MaterialList materials={materials} onDelete={handleMaterialDeleted} />
        </div>
      )}

      <GenerationPanel
        unitId={unitId}
        unitCode={unitCode}
        unitName={unitName}
        teachingAllocationId={teachingAllocationId}
        topics={topics}
        materialCount={ingestedCount}
        processingCount={activeProcessingCount}
      />
    </div>
  );
}
