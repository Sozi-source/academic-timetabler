import { createAdminClient } from '@/lib/supabase/admin';
import {
  normalizeCurriculumLearningOutcomes,
  normalizeCurriculumSubtopics,
  normalizeCurriculumTopicTitle,
} from '@/features/teaching-documents/curriculum-content-normalizer';

async function main() {
  const admin = createAdminClient();

  // 1. Clean curriculum_document_versions
  const { data: versions, error: vError } = await admin
    .from('curriculum_document_versions')
    .select('id, unit_id, document_type, version_number, status, payload')
    .eq('status', 'active');

  if (vError) {
    console.error('Error fetching curriculum_document_versions:', vError);
    return;
  }

  console.log(`Cleaning ${versions?.length ?? 0} active curriculum_document_versions rows...`);

  let updatedCount = 0;
  for (const v of versions || []) {
    const payload = v.payload as any;
    if (!payload) continue;

    let modified = false;

    // Clean unit metadata
    if (payload.unit && payload.unit.coreLearningOutcomes) {
      const originalLO = payload.unit.coreLearningOutcomes;
      const cleanedLO = normalizeCurriculumLearningOutcomes(originalLO).join('\n');
      if (cleanedLO !== originalLO) {
        payload.unit.coreLearningOutcomes = cleanedLO;
        modified = true;
      }
    }

    // Clean content rows
    if (Array.isArray(payload.content)) {
      for (const row of payload.content) {
        if (row.topic) {
          const cleanTopic = normalizeCurriculumTopicTitle(row.topic);
          if (cleanTopic !== row.topic) {
            row.topic = cleanTopic;
            modified = true;
          }
        }
        if (row.coverage) {
          const cleanSubtopics = normalizeCurriculumSubtopics(row.coverage);
          const cleanCoverage = cleanSubtopics.join(' · ');
          if (cleanCoverage !== row.coverage) {
            row.coverage = cleanCoverage;
            modified = true;
          }
        }
      }
    }

    if (modified) {
      const { error: updateError } = await admin
        .from('curriculum_document_versions')
        .update({ payload })
        .eq('id', v.id);

      if (updateError) {
        console.error(`Error updating version ${v.id}:`, updateError);
      } else {
        updatedCount++;
        console.log(`Updated curriculum_document_versions ${v.id} (Unit: ${v.unit_id}, Type: ${v.document_type}, v${v.version_number})`);
      }
    }
  }

  console.log(`Successfully updated ${updatedCount} curriculum_document_versions.`);

  // 2. Clean trainer_teaching_document_versions if any
  try {
    const { data: trainerVersions, error: tError } = await admin
      .from('trainer_teaching_document_versions')
      .select('id, unit_id, document_type, status, source_payload')
      .eq('status', 'active');

    if (!tError && trainerVersions && trainerVersions.length > 0) {
      console.log(`Cleaning ${trainerVersions.length} active trainer_teaching_document_versions rows...`);
      let tUpdatedCount = 0;

      for (const tv of trainerVersions) {
        const payload = tv.source_payload as any;
        if (!payload || !Array.isArray(payload.content)) continue;

        let modified = false;
        for (const row of payload.content) {
          if (row.topic) {
            const cleanTopic = normalizeCurriculumTopicTitle(row.topic);
            if (cleanTopic !== row.topic) {
              row.topic = cleanTopic;
              modified = true;
            }
          }
          if (row.coverage) {
            const cleanSubtopics = normalizeCurriculumSubtopics(row.coverage);
            const cleanCoverage = cleanSubtopics.join(' · ');
            if (cleanCoverage !== row.coverage) {
              row.coverage = cleanCoverage;
              modified = true;
            }
          }
        }

        if (modified) {
          const { error: updateError } = await admin
            .from('trainer_teaching_document_versions')
            .update({ source_payload: payload })
            .eq('id', tv.id);

          if (!updateError) {
            tUpdatedCount++;
            console.log(`Updated trainer_teaching_document_versions ${tv.id}`);
          }
        }
      }
      console.log(`Successfully updated ${tUpdatedCount} trainer_teaching_document_versions.`);
    }
  } catch (err) {
    console.warn('Could not clean trainer_teaching_document_versions:', err);
  }
}

main().catch(console.error);
