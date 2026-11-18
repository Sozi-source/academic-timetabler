import { describe, expect, it } from 'vitest';

import { buildUnitSiblingResolver } from '@/features/assessment/unit-sibling-groups';

describe('buildUnitSiblingResolver', () => {
  it('links units sharing a confirmed_shared_offering_id or approved equivalence_group_id without self-links', () => {
    const resolver = buildUnitSiblingResolver(
      [
        { unit_id: 'u-cnd', confirmed_shared_offering_id: 'shared-1' },
        { unit_id: 'u-dhn', confirmed_shared_offering_id: 'shared-1' },
        { unit_id: 'u-solo', confirmed_shared_offering_id: null },
      ],
      [
        { unit_id: 'u-dhn', equivalence_group_id: 'eq-1' },
        { unit_id: 'u-dndt', equivalence_group_id: 'eq-1' },
      ],
    );

    expect(resolver.siblingsOf('u-cnd')).toEqual(['u-dhn']);
    expect(resolver.siblingsOf('u-dhn').sort()).toEqual(['u-cnd', 'u-dndt']);
    expect(resolver.siblingsOf('u-dndt')).toEqual(['u-dhn']);
    // Non-transitive: u-cnd and u-dndt are not directly linked
    expect(resolver.siblingsOf('u-cnd')).not.toContain('u-dndt');
    expect(resolver.siblingsOf('u-solo')).toEqual([]);

    // Connected component canonical group key deduplicates all units in the same shared/equivalent class
    expect(resolver.groupKeyOf('u-cnd')).toBe('u-cnd');
    expect(resolver.groupKeyOf('u-dhn')).toBe('u-cnd');
    expect(resolver.groupKeyOf('u-dndt')).toBe('u-cnd');
    expect(resolver.groupKeyOf('u-solo')).toBe('u-solo');
  });
});
