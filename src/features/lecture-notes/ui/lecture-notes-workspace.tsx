'use client';

import { useState } from 'react';
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
      created_at: m.createdAt,
    }))
  );

  function handleMaterialAdded(material: Material) {
    setMaterials((prev) => [material, ...prev]);
  }

  function handleMaterialDeleted(id: string) {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  }

  const ingestedCount = materials.filter((m) => m.ingested_at != null).length;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Upload zone */}
      <MaterialUploadForm
        unitId={unitId}
        teachingAllocationId={teachingAllocationId}
        onMaterialAdded={handleMaterialAdded}
      />

      {/* Material library — only shown when there are materials */}
      {materials.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Source Library ({materials.length})
          </p>
          <MaterialList materials={materials} onDelete={handleMaterialDeleted} />
        </div>
      )}

      {/* Generation */}
      <GenerationPanel
        unitId={unitId}
        unitCode={unitCode}
        unitName={unitName}
        teachingAllocationId={teachingAllocationId}
        topics={topics}
        materialCount={ingestedCount}
      />
    </div>
  );
}
