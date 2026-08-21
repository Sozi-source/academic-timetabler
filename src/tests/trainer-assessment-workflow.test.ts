import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  canCommitStaffBatch,
  canDownloadStaffMarkbook,
  canDownloadStaffSigningSheet,
  canEditStaffAttendance,
  canGenerateStaffPopulation,
  canStageStaffMarkbook,
  canUseStaffOnlineMarks,
} from '@/features/staff-assessment/workflow-domain';

describe('trainer assessment workflow domain', () => {
  it('allows population and attendance only before roster lock', () => {
    const open = {
      workflowStatus:
        'generated',
      populationLocked:
        false,
      populationCount:
        20,
      ruleConfigured:
        true,
    };

    expect(
      canGenerateStaffPopulation(
        open,
      ),
    ).toBe(
      true,
    );

    expect(
      canEditStaffAttendance(
        open,
      ),
    ).toBe(
      true,
    );

    expect(
      canDownloadStaffMarkbook(
        open,
      ),
    ).toBe(
      true,
    );
  });

  it('allows signing and staging after lock but not attendance changes', () => {
    const locked = {
      workflowStatus:
        'open',
      populationLocked:
        true,
      populationCount:
        20,
      ruleConfigured:
        true,
    };

    expect(
      canEditStaffAttendance(
        locked,
      ),
    ).toBe(
      false,
    );

    expect(
      canDownloadStaffSigningSheet(
        locked,
      ),
    ).toBe(
      true,
    );

    expect(
      canStageStaffMarkbook(
        locked,
      ),
    ).toBe(
      true,
    );


    expect(
      canUseStaffOnlineMarks({
        state:
          locked,
        assessmentType:
          'exam',
        maximumMark:
          100,
      }),
    ).toBe(
      true,
    );

    expect(
      canUseStaffOnlineMarks({
        state:
          locked,
        assessmentType:
          'cat',
        maximumMark:
          15,
      }),
    ).toBe(
      false,
    );
  });

  it('requires a configured rule before staging marks', () => {
    expect(
      canStageStaffMarkbook({
        workflowStatus:
          'open',
        populationLocked:
          true,
        populationCount:
          10,
        ruleConfigured:
          false,
      }),
    ).toBe(
      false,
    );
  });

  it('commits only ready batches with no missing marks', () => {
    expect(
      canCommitStaffBatch({
        status:
          'ready',
        totalRows:
          10,
        missingMarks:
          0,
      }),
    ).toBe(
      true,
    );

    expect(
      canCommitStaffBatch({
        status:
          'ready',
        totalRows:
          10,
        missingMarks:
          1,
      }),
    ).toBe(
      false,
    );
  });
});
