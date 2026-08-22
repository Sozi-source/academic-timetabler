import {
  getUnitCurriculum,
  type UnitCurriculumDefinition,
} from './curriculum-registry';

export interface TVETDocumentHeaderContext {
  institutionName: string;
  departmentName: string;
  academicPeriodName: string;
  unitCode: string;
  unitName: string;
  cohortName: string;
  trainerName: string;
  trainerEmail?: string | null;
  totalNominalHours: number;
  weeklyHours: number;
}

export interface TVETCourseOutlineTopic {
  weekNumber: number;
  topicTitle: string;
  subTopics: string[];
  hours: number;
}

export interface TVETCourseOutlineData {
  header: TVETDocumentHeaderContext;
  unitDescription: string;
  overallCompetency: string;
  learningOutcomes: string[];
  weeklySchedule: TVETCourseOutlineTopic[];
  assessmentMatrix: {
    continuousAssessment: {
      assignment: number; // 5%
      presentation: number; // 10%
      rat: number; // 15%
      cat: number; // 15%
      courseworkWeightedTotal: number; // 30%
    };
    finalExamination: number; // 70%
    finalTotal: number; // 100%
  };
  references: string[];
  instructionalEquipment: string[];
}

export interface TVETSchemeOfWorkWeek {
  weekNumber: number;
  topic: string;
  subTopics: string;
  specificLearningOutcomes: string;
  learningActivities: string;
  resourcesAndReferences: string;
  assessmentAndRemarks: string;
}

export interface TVETSchemeOfWorkData {
  header: TVETDocumentHeaderContext;
  plannedWeeks: TVETSchemeOfWorkWeek[];
}

export interface TVETRecordOfWorkEntry {
  id: string;
  allocationId: string;
  weekNumber: number;
  sessionDate: string;
  workCovered: string;
  outcomesAchieved: string;
  attendanceSummary: string;
  remarks: string;
  trainerSignature: string;
  signedAt: string;
  hodStatus: 'pending' | 'verified';
}

export interface TVETRecordOfWorkData {
  header: TVETDocumentHeaderContext;
  entries: TVETRecordOfWorkEntry[];
  totalPlannedWeeks: number;
  completedWeeksCount: number;
  syllabusCompletionRate: number;
}

/**
 * Standard TVET Course Outline Generator
 * Pulls from the TVET Curriculum Registry and injects dynamic allocation headers.
 */
export function generateTVETCourseOutline(
  context: TVETDocumentHeaderContext
): TVETCourseOutlineData {
  const curriculum = getUnitCurriculum(context.unitCode, context.unitName, 'course_outline');

  let weeklySchedule: TVETCourseOutlineTopic[] = [];

  if (curriculum.weeklySchedule && curriculum.weeklySchedule.length > 0) {
    // Map existing custom seeded schedule
    weeklySchedule = curriculum.weeklySchedule.map((ws, i) => ({
      weekNumber: ws.weekNumber ?? i + 1,
      topicTitle: ws.topicTitle,
      subTopics: ws.subTopics ?? [],
      hours: ws.hours ?? context.weeklyHours,
    }));
  }

  // If seeded schedule has fewer than 14 weeks, polish and fill to 14 standard TVET weeks
  if (weeklySchedule.length < 14) {
    const existingCount = weeklySchedule.length;
    const defaultTopics: TVETCourseOutlineTopic[] = [
      {
        weekNumber: 1,
        topicTitle: `Introduction to ${context.unitName} & Occupational Safety`,
        subTopics: ['Course overview & objectives', 'TVET competency framework', 'Workshop/Laboratory safety protocols'],
        hours: context.weeklyHours,
      },
      {
        weekNumber: 2,
        topicTitle: 'Fundamental Principles & Theoretical Foundations',
        subTopics: ['Key terminologies and definitions', 'Core conceptual frameworks', 'Industry standards and compliance'],
        hours: context.weeklyHours,
      },
      {
        weekNumber: 3,
        topicTitle: 'Core Methodology & Applied Tools',
        subTopics: ['Standard operating procedures', 'Equipment selection and calibration', 'Practical demonstrations'],
        hours: context.weeklyHours,
      },
      {
        weekNumber: 4,
        topicTitle: 'Skill Application & Field Techniques',
        subTopics: ['Case analysis and diagnostic procedures', 'Step-by-step task execution', 'Workplace documentation'],
        hours: context.weeklyHours,
      },
      {
        weekNumber: 5,
        topicTitle: 'Continuous Assessment 1 (RAT & Assignment Review)',
        subTopics: ['Readiness Assessment Test (RAT)', 'Review of Assignment 1 submissions', 'Remedial feedback'],
        hours: context.weeklyHours,
      },
      {
        weekNumber: 6,
        topicTitle: 'Intermediate Competency Building & Practice',
        subTopics: ['Specialised practical modules', 'Group workshops and troubleshooting', 'Quality assurance measures'],
        hours: context.weeklyHours,
      },
      {
        weekNumber: 7,
        topicTitle: 'Mid-Term Review & Applied Project Work',
        subTopics: ['Project milestone evaluations', 'Integrated practical exercises', 'Peer assessment'],
        hours: context.weeklyHours,
      },
      {
        weekNumber: 8,
        topicTitle: 'Continuous Assessment 2 (Official CAT)',
        subTopics: ['Continuous Assessment Test (CAT)', 'CAT marking and individual performance debrief'],
        hours: context.weeklyHours,
      },
      {
        weekNumber: 9,
        topicTitle: 'Advanced Applications & Emerging Trends',
        subTopics: ['Industry best practices', 'Modern digital tools and innovations', 'Complex problem solving'],
        hours: context.weeklyHours,
      },
      {
        weekNumber: 10,
        topicTitle: 'Practical Skill Demonstrations & Presentations',
        subTopics: ['Student individual/group presentations', 'Practical competency assessment', 'Rubric evaluation'],
        hours: context.weeklyHours,
      },
      {
        weekNumber: 11,
        topicTitle: 'Professional Ethics & Industry Regulations',
        subTopics: ['Statutory requirements and ethical standards', 'Client/Patient/Consumer relations', 'Report writing'],
        hours: context.weeklyHours,
      },
      {
        weekNumber: 12,
        topicTitle: 'Comprehensive Practical Evaluation & Review',
        subTopics: ['Final practical test execution', 'Competency checklist sign-off', 'Review of logbooks'],
        hours: context.weeklyHours,
      },
      {
        weekNumber: 13,
        topicTitle: 'Course Synthesis, Revision & Exam Preparation',
        subTopics: ['Comprehensive syllabus review', 'Past examination question analysis', 'Examination guidelines'],
        hours: context.weeklyHours,
      },
      {
        weekNumber: 14,
        topicTitle: 'End of Term Assessment & Final Examinations',
        subTopics: ['End-Term Examination (70%)', 'Departmental assessment compilation', 'Grade finalisation'],
        hours: context.weeklyHours,
      },
    ];

    if (existingCount === 0) {
      weeklySchedule = defaultTopics;
    } else {
      for (let w = existingCount + 1; w <= 14; w++) {
        weeklySchedule.push({
          ...defaultTopics[w - 1],
          weekNumber: w,
        });
      }
    }
  }

  return {
    header: context,
    unitDescription:
      curriculum.unitDescription ??
      `This competency-based TVET course outline prepares trainees with requisite knowledge, practical skills, and professional attitudes in ${context.unitName} (${context.unitCode}). Trainees engage in theoretical lectures, interactive laboratory sessions, and continuous competency-based assessments in accordance with national TVET standards.`,
    overallCompetency:
      curriculum.overallCompetency ??
      `Upon completion of this unit, the trainee will demonstrate comprehensive mastery in ${context.unitName}, applying industry-standard methods and adhering to safety and quality guidelines in professional workplace environments.`,
    learningOutcomes:
      curriculum.learningOutcomes ?? [
        `Explain the fundamental concepts, regulatory frameworks, and professional ethics of ${context.unitName}.`,
        'Demonstrate technical proficiency in selecting and operating relevant diagnostic and operational tools.',
        'Execute practical tasks and produce compliant workplace documentation and records.',
        'Evaluate outcomes and implement corrective actions for technical deviations and quality control.',
        'Perform collaborative tasks effectively within workplace teams while observing health and safety standards.',
      ],
    weeklySchedule,
    assessmentMatrix: {
      continuousAssessment: {
        assignment: 5,
        presentation: 10,
        rat: 15,
        cat: 15,
        courseworkWeightedTotal: 30, // Assignment(5) + Presentation(10) + AVG(RAT 15, CAT 15) = 30%
      },
      finalExamination: 70,
      finalTotal: 100,
    },
    references:
      curriculum.references ?? [
        'National TVET Curriculum Guide and Assessment Standards (CDACC/KNEC).',
        `${context.unitName} Practical Manual & Reference Guide (College Department Edition).`,
        'Relevant Statutory and Professional Council Guidelines.',
      ],
    instructionalEquipment:
      curriculum.instructionalEquipment ?? [
        'Standard College Workshop/Laboratory Workstations and Toolkits.',
        'Multimedia Projector, Whiteboard, and Digital Resource Materials.',
        'Safety Gear (PPE) and Material Safety Data Sheets (MSDS).',
      ],
  };
}

/**
 * Standard TVET Scheme of Work Generator
 * Uses seeded unit topics or generates polished 14-week TVET lesson matrix.
 */
export function generateTVETSchemeOfWork(
  context: TVETDocumentHeaderContext
): TVETSchemeOfWorkData {
  const outline = generateTVETCourseOutline(context);
  const curriculum = getUnitCurriculum(context.unitCode, context.unitName, 'scheme_of_work');

  const seedScheduleMap = new Map(
    (curriculum.weeklySchedule ?? []).map((w) => [w.weekNumber, w])
  );

  const plannedWeeks: TVETSchemeOfWorkWeek[] = outline.weeklySchedule.map((sched) => {
    const custom = seedScheduleMap.get(sched.weekNumber);

    let activities = custom?.learningActivities ?? 'Lecture, guided discussions, and practical demonstration';
    let assessment = custom?.assessmentAndRemarks ?? 'Formative oral questioning, worksheet review';
    let resources = custom?.resourcesAndReferences ?? 'Core textbook, charts, multimedia slides';

    if (sched.weekNumber === 5) {
      activities = custom?.learningActivities ?? 'Supervised RAT administration, assignment feedback session';
      assessment = custom?.assessmentAndRemarks ?? 'Written RAT (15 Marks), Assignment marking';
      resources = custom?.resourcesAndReferences ?? 'Standardized test papers, evaluation rubrics';
    } else if (sched.weekNumber === 8) {
      activities = custom?.learningActivities ?? 'Continuous Assessment Test (CAT) session';
      assessment = custom?.assessmentAndRemarks ?? 'Official CAT (15 Marks)';
      resources = custom?.resourcesAndReferences ?? 'Examination booklets, invigilation sheets';
    } else if (sched.weekNumber === 10) {
      activities = custom?.learningActivities ?? 'Trainee presentations, practical demonstrations';
      assessment = custom?.assessmentAndRemarks ?? 'Presentation evaluation (10 Marks)';
      resources = custom?.resourcesAndReferences ?? 'Presentation rubrics, equipment workstations';
    } else if (sched.weekNumber === 14) {
      activities = custom?.learningActivities ?? 'Final examinations administration';
      assessment = custom?.assessmentAndRemarks ?? 'Summative Final Examination (70 Marks)';
      resources = custom?.resourcesAndReferences ?? 'Official exam question papers and answer booklets';
    }

    return {
      weekNumber: sched.weekNumber,
      topic: sched.topicTitle,
      subTopics: sched.subTopics.join(', '),
      specificLearningOutcomes: `By the end of the week, the trainee should be able to: ${sched.subTopics.map((st) => st.toLowerCase()).join('; ')}.`,
      learningActivities: activities,
      resourcesAndReferences: resources,
      assessmentAndRemarks: assessment,
    };
  });

  return {
    header: context,
    plannedWeeks,
  };
}

/**
 * Computes Record of Work summary statistics
 */
export function computeRecordOfWorkSummary(
  context: TVETDocumentHeaderContext,
  entries: TVETRecordOfWorkEntry[],
  totalPlannedWeeks = 14
): TVETRecordOfWorkData {
  const uniqueDeliveredWeeks = new Set(entries.map((e) => e.weekNumber)).size;
  const syllabusCompletionRate = Math.min(
    100,
    Math.round((uniqueDeliveredWeeks / totalPlannedWeeks) * 100)
  );

  return {
    header: context,
    entries: [...entries].sort((a, b) => a.weekNumber - b.weekNumber || a.sessionDate.localeCompare(b.sessionDate)),
    totalPlannedWeeks,
    completedWeeksCount: uniqueDeliveredWeeks,
    syllabusCompletionRate,
  };
}
