-- Migration: 20261110020000_sync_record_of_work_with_scheme_and_restore_lipids.sql
-- Description: Synchronize Record of Work entries with the authoritative KNEC Scheme of Work for Biochemistry II (DHN 2304 / DND 3106 / DNDT 1207).
-- Restores Lipid Metabolism at Weeks 6 and 7 (which was erroneously skipped), places CAT at Week 8, Nucleic Acids at Week 9,
-- and replaces repetitive stock practical boilerplate with authentic scheme-derived learning outcomes.

-- 1. Allocation 7f855ffc-9692-4577-ad9b-9948066aae3f (DHN 2304 Biochemistry II)

-- Week 1: Carbohydrate Metabolism
UPDATE record_of_work_entries
SET
  topic_covered = 'Carbohydrate Metabolism',
  objectives = E'By the end of the lesson/topic, the trainee should be able to:\n• Define fundamental terms used in carbohydrate metabolism and cellular bioenergetics.\n• Explain the sequential reactions, regulatory enzymes, and biological significance of glycolysis.'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND week_number = 1 AND session_number = 1;

UPDATE record_of_work_entries
SET
  topic_covered = 'Carbohydrate Metabolism (Practical Application)',
  objectives = E'By the end of the practical session, the trainee should be able to:\n• Apply diagnostic principles, terminology, and foundational concepts of carbohydrate metabolism to practical exercises.\n• Trace biochemical pathway steps, calculate net energy yield (ATP), and diagram intermediate stages of Glycolysis.'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND week_number = 1 AND session_number = 2;

-- Week 2: Carbohydrate Metabolism (Krebs cycle)
UPDATE record_of_work_entries
SET
  topic_covered = 'Carbohydrate Metabolism',
  objectives = E'By the end of the lesson/topic, the trainee should be able to:\n• Describe the aerobic and anaerobic fates of pyruvate under varying physiological conditions.\n• Explain the cyclic reactions, coenzymes, and regulatory checkpoints of the Krebs cycle.'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND week_number = 2 AND session_number = 1;

UPDATE record_of_work_entries
SET
  topic_covered = 'Carbohydrate Metabolism (Practical Application)',
  objectives = E'By the end of the practical session, the trainee should be able to:\n• Trace biochemical pathway steps and diagram aerobic and anaerobic transformations of Pyruvate.\n• Perform reaction mapping, enzyme cofactor analysis, and calculate ATP yield for the Krebs cycle.'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND week_number = 2 AND session_number = 2;

-- Week 3: Carbohydrate Metabolism (Electron transport & oxidative phosphorylation)
UPDATE record_of_work_entries
SET
  topic_covered = 'Carbohydrate Metabolism',
  objectives = E'By the end of the lesson/topic, the trainee should be able to:\n• Explain the structural organization of electron transport complexes and proton pumping mechanisms.\n• Detail the chemiosmotic coupling hypothesis and ATP synthase mechanism in oxidative phosphorylation.'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND week_number = 3 AND session_number = 1;

UPDATE record_of_work_entries
SET
  topic_covered = 'Carbohydrate Metabolism (Practical Application)',
  objectives = E'By the end of the practical session, the trainee should be able to:\n• Diagram electron flow through mitochondrial complexes I–IV and calculate P:O ratios.\n• Examine the effects of metabolic inhibitors and uncoupling agents on respiratory chain function.'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND week_number = 3 AND session_number = 2;

-- Week 4: Protein Metabolism (Deamination & Transamination)
UPDATE record_of_work_entries
SET
  topic_covered = 'Protein Metabolism',
  objectives = E'By the end of the lesson/topic, the trainee should be able to:\n• Describe the biochemical mechanisms and cofactors (PLP) of transamination reactions.\n• Explain oxidative deamination of glutamate and nitrogen turnover in amino acid catabolism.'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND week_number = 4 AND session_number = 1;

UPDATE record_of_work_entries
SET
  topic_covered = 'Protein Metabolism (Practical Application)',
  objectives = E'By the end of the practical session, the trainee should be able to:\n• Trace aminotransferase reactions (ALT, AST) and interpret their clinical significance as serum biomarkers.\n• Solve metabolic pathway exercises detailing nitrogen transfer to alpha-ketoglutarate.'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND week_number = 4 AND session_number = 2;

-- Week 5: Protein Metabolism (Urea cycle & Diseases)
UPDATE record_of_work_entries
SET
  topic_covered = 'Protein Metabolism',
  objectives = E'By the end of the lesson/topic, the trainee should be able to:\n• Outline the compartmentalized reactions and regulation of the urea cycle in hepatic tissue.\n• Describe clinical inborn errors and pathologies associated with protein and nitrogen metabolism.'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND week_number = 5 AND session_number = 1;

UPDATE record_of_work_entries
SET
  topic_covered = 'Protein Metabolism (Practical Application)',
  objectives = E'By the end of the practical session, the trainee should be able to:\n• Diagram the five enzymatic steps of the urea cycle and account for ATP expenditure in ammonia disposal.\n• Evaluate patient case studies on hyperammonemia, phenylketonuria (PKU), and maple syrup urine disease.'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND week_number = 5 AND session_number = 2;

-- Week 6: Lipid Metabolism (Fatty acid activation & Beta-oxidation)
UPDATE record_of_work_entries
SET
  topic_covered = 'Lipid Metabolism',
  objectives = E'By the end of the lesson/topic, the trainee should be able to:\n• Explain the mechanism of fatty acid activation and carnitine-mediated mitochondrial shuttle transport.\n• Describe the repeating cycle of beta-oxidation (oxidation, hydration, oxidation, thiolysis) and energy generation.'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND week_number = 6 AND session_number = 1;

UPDATE record_of_work_entries
SET
  topic_covered = 'Lipid Metabolism (Practical Application)',
  objectives = E'By the end of the practical session, the trainee should be able to:\n• Calculate the complete stoichiometric yield of ATP generated from saturated even-chain fatty acids (e.g. palmitate).\n• Trace metabolic intermediate transformations during successive rounds of mitochondrial beta-oxidation.'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND week_number = 6 AND session_number = 2;

-- Week 7: Lipid Metabolism (Diseases associated with lipid metabolism)
UPDATE record_of_work_entries
SET
  topic_covered = 'Lipid Metabolism',
  objectives = E'By the end of the lesson/topic, the trainee should be able to:\n• Identify and classify metabolic diseases and pathological states associated with impaired lipid metabolism.\n• Explain the biochemical basis of ketoacidosis, dyslipidemia, atherosclerosis, and sphingolipidoses.'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND week_number = 7 AND session_number = 1;

UPDATE record_of_work_entries
SET
  topic_covered = 'Lipid Metabolism (Practical Application)',
  objectives = E'By the end of the practical session, the trainee should be able to:\n• Interpret serum lipid profile reports (cholesterol, triglycerides, LDL, HDL) in cardiovascular risk assessment.\n• Analyze clinical nutrition case studies concerning diabetic ketoacidosis and fatty acid transport deficiencies.'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND week_number = 7 AND session_number = 2;

-- Week 8: Continuous Assessment Test (CAT)
UPDATE record_of_work_entries
SET
  topic_covered = 'Continuous Assessment Test (CAT)',
  objectives = E'By the end of the assessment session, the trainee should be able to:\n• Complete the continuous assessment test questions accurately within the allocated timeframe.\n• Demonstrate recall, analytical problem-solving, and mastery of metabolic pathways covered in Weeks 1–7.'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND week_number = 8 AND session_number = 1;

UPDATE record_of_work_entries
SET
  topic_covered = 'Continuous Assessment Test (CAT) Review & Remediation',
  objectives = E'By the end of the review session, the trainee should be able to:\n• Review CAT performance, discuss marking rubrics, and resolve difficult questions across Weeks 1–7.\n• Clarify misconceptions regarding carbohydrate, protein, and lipid metabolic integration.'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND week_number = 8 AND session_number = 2;

-- Week 9: Nucleic Acids and Nucleotides (DNA)
UPDATE record_of_work_entries
SET
  topic_covered = 'Nucleic Acids and Nucleotides',
  objectives = E'By the end of the lesson/topic, the trainee should be able to:\n• Define terms related to purines, pyrimidines, nucleosides, and nucleotide structure.\n• Describe the double-helical structure of DNA, Watson-Crick base pairing, and biological functions.'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND week_number = 9 AND session_number = 1;

UPDATE record_of_work_entries
SET
  topic_covered = 'Nucleic Acids and Nucleotides (Practical Application)',
  objectives = E'By the end of the practical session, the trainee should be able to:\n• Construct molecular models demonstrating phosphodiester linkages and antiparallel polynucleotide strands.\n• Differentiate chemical stability, denaturation dynamics, and UV absorption characteristics of DNA.'
WHERE allocation_id = '7f855ffc-9692-4577-ad9b-9948066aae3f' AND week_number = 9 AND session_number = 2;

-- 2. Allocation ffe68fa0-3443-4f57-b8ca-5843b060e958 (Biochemistry II parallel allocation)
UPDATE record_of_work_entries
SET
  topic_covered = 'Carbohydrate Metabolism',
  objectives = E'By the end of the lesson/topic, the trainee should be able to:\n• Define fundamental terms used in carbohydrate metabolism and cellular bioenergetics.\n• Explain the sequential reactions, regulatory enzymes, and biological significance of glycolysis.'
WHERE id = '0cc08173-b0d3-425b-9225-fb1236af8418';
