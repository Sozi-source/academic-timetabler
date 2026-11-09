begin;

-- Retire legacy Biochemistry II course outline versions in curriculum_document_versions
-- that contained erroneous topics (e.g. Introduction to Biochemistry, Coenzymes,
-- Amino Acid Anabolism, Ornithine Cycle, Energy Metabolism/Balance, Dietary requirement calculations,
-- or vitamin/mineral/lab topics from Basic Biochemistry).
-- Retiring these active versions allows the curriculum engine to serve the clean,
-- authoritative Biochemistry II syllabus (Carbohydrate Metabolism, Protein Metabolism,
-- Lipid Metabolism, Nucleic Acids and Nucleotides, Enzymology, Emerging Issues and Trends).
update public.curriculum_document_versions as version
set
  status = 'superseded',
  superseded_at = now(),
  updated_at = now()
from public.units as unit
where version.unit_id = unit.id
  and version.status = 'active'
  and (
    upper(regexp_replace(unit.code, '[^a-zA-Z0-9]', '', 'g')) in ('DHN2304', 'DND3106', 'DNDT1207')
    or lower(trim(unit.name)) = 'biochemistry ii'
  );

commit;
