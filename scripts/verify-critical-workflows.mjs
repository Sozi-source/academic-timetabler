import {
  existsSync,
  readFileSync,
} from 'node:fs';
import {
  resolve,
} from 'node:path';

const root =
  process.cwd();

const required = [
  'supabase/migrations/20260821202000_teaching_document_template_ingestion_v15.sql',
  'supabase/migrations/20260821211500_teaching_document_workflow_v16.sql',
  'supabase/migrations/20260821214500_student_portal_access_admin_v17.sql',
  'supabase/migrations/20260821223000_online_marks_entry_v18_2.sql',
  'supabase/migrations/20260821230000_class_attendance_v19.sql',
  'supabase/migrations/20260821235900_operations_oversight_v20.sql',
  'supabase/migrations/20260822133000_release_go_live_controls_v23.sql',
  'supabase/migrations/20260822143000_pilot_operations_v24.sql',
  'src/app/student/page.tsx',
  'src/app/(staff)/staff/attendance/page.tsx',
  'src/app/(dashboard)/operations/page.tsx',
  'src/app/(dashboard)/attendance-clinical/class-attendance/page.tsx',
  'src/app/(dashboard)/testing/defects/page.tsx',
  'src/app/(dashboard)/testing/sign-off/page.tsx',
  'src/app/(dashboard)/testing/deployments/page.tsx',
  'src/app/(dashboard)/operations/action-center/page.tsx',
  'src/app/(dashboard)/operations/incidents/page.tsx',
  'src/app/api/testing/release-evidence/route.ts',
];

const errors = [];

const forbiddenLegacyOperationsImports = [
  'getHodAttendanceOverview',
  'getOperationsHistory',
  'operationsActionTotal',
  'operationsEventLabel',
  'formatOperationsTime',
  'OperationsActionItem',
];

const legacyCompatibilityFiles = [
  'src/app/(dashboard)/attendance/page.tsx',
  'src/app/(dashboard)/attendance/[sessionId]/page.tsx',
  'src/app/(dashboard)/operations/history/page.tsx',
  'src/tests/operations-domain.test.ts',
];

for (
  const relative of
    legacyCompatibilityFiles
) {
  const absolute =
    resolve(
      root,
      relative,
    );

  if (
    !existsSync(
      absolute,
    )
  ) {
    continue;
  }

  const content =
    readFileSync(
      absolute,
      'utf8',
    );

  for (
    const forbidden of
      forbiddenLegacyOperationsImports
  ) {
    if (
      content.includes(
        forbidden,
      )
    ) {
      errors.push(
        `Legacy Operations Pack API remains in ${relative}: ${forbidden}`,
      );
    }
  }
}

for (
  const relative of
    required
) {
  if (
    !existsSync(
      resolve(
        root,
        relative,
      ),
    )
  ) {
    errors.push(
      `Missing critical file: ${relative}`,
    );
  }
}

const attendanceDomain =
  resolve(
    root,
    'src/features/class-attendance/domain.ts',
  );

if (
  existsSync(
    attendanceDomain,
  )
) {
  const content =
    readFileSync(
      attendanceDomain,
      'utf8',
    );

  if (
    content.includes(
      "'late'",
    ) ||
    content.includes(
      "'excused'",
    )
  ) {
    errors.push(
      'Class attendance must expose only Present / Absent for the current release.',
    );
  }
}

const workbook =
  resolve(
    root,
    'src/features/assessment/marks/workbook.ts',
  );

if (
  existsSync(
    workbook,
  )
) {
  const content =
    readFileSync(
      workbook,
      'utf8',
    );

  for (
    const marker of [
      'RAT /15',
      'CAT 1 /15',
      'End Term Exam /70',
    ]
  ) {
    if (
      !content.includes(
        marker,
      )
    ) {
      errors.push(
        `Existing Excel marksheet marker is missing: ${marker}`,
      );
    }
  }
}


const pilotOperationsMigration =
  resolve(
    root,
    'supabase/migrations/20260822143000_pilot_operations_v24.sql',
  );

if (
  existsSync(
    pilotOperationsMigration,
  )
) {
  const content =
    readFileSync(
      pilotOperationsMigration,
      'utf8',
    );

  for (
    const marker of [
      'release_deployments',
      'production_incidents',
      'record_release_deployment',
      'rollback_release_deployment',
      'create_production_incident',
      'update_production_incident_status',
    ]
  ) {
    if (
      !content.includes(
        marker,
      )
    ) {
      errors.push(
        `V24 production-control marker is missing: ${marker}`,
      );
    }
  }
}

if (
  errors.length >
  0
) {
  console.error(
    '\nCritical workflow verification failed:\n',
  );

  for (
    const error of
      errors
  ) {
    console.error(
      `- ${error}`,
    );
  }

  process.exit(
    1,
  );
}

console.log(
  'Critical workflow verification passed.',
);
console.log(
  'Student portal, teaching documents, online marks, class attendance, operations, release controls, deployment controls, incident controls and existing Excel marksheet markers are present.',
);
