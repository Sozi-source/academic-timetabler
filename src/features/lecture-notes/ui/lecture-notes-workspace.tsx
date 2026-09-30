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

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
      {/* Left: Materials panel */}
      <div className="space-y-4">
        <MaterialUploadForm
          unitId={unitId}
          teachingAllocationId={teachingAllocationId}
          onMaterialAdded={handleMaterialAdded}
        />
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Source Library ({materials.length})
          </p>
          <MaterialList materials={materials} onDelete={handleMaterialDeleted} />
        </div>
      </div>

      {/* Right: Generation panel */}
      <GenerationPanel
        unitId={unitId}
        unitCode={unitCode}
        unitName={unitName}
        teachingAllocationId={teachingAllocationId}
        topics={topics}
        materialCount={materials.filter((m) => m.ingested_at != null).length}
      />
    </div>
  );
}
