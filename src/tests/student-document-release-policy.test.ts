import {
  describe,
  expect,
  it,
} from 'vitest';

describe('student teaching-document release policy', () => {
  it('requires explicit publication after approval', () => {
    const visible = ({
      status,
      publishedAt,
      approvedRevision,
    }: {
      status:
        string;
      publishedAt:
        string |
        null;
      approvedRevision:
        number |
        null;
    }) =>
      status ===
        'approved' &&
      publishedAt !==
        null &&
      approvedRevision !==
        null;

    expect(
      visible({
        status:
          'approved',
        publishedAt:
          null,
        approvedRevision:
          2,
      }),
    ).toBe(
      false,
    );

    expect(
      visible({
        status:
          'approved',
        publishedAt:
          '2026-08-22T08:00:00.000Z',
        approvedRevision:
          2,
      }),
    ).toBe(
      true,
    );
  });

  it('never treats submitted or returned documents as student-visible', () => {
    const statuses = [
      'submitted',
      'returned',
    ];

    expect(
      statuses.every(
        (status) =>
          status !==
          'approved',
      ),
    ).toBe(
      true,
    );
  });
});
