import 'server-only';

import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

import type {
  PublishedSessionSnapshot,
  TimetablePublicationEvent,
  TimetableVersion,
} from './types';

export const getTimetableVersions = cache(async (
  academicPeriodId: string,
): Promise<TimetableVersion[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('timetable_versions')
    .select(`
      id,
      academic_period_id,
      version_number,
      status,
      title,
      change_summary,
      session_count,
      conflict_count,
      snapshot,
      created_at,
      submitted_at,
      approved_at,
      published_at,
      archived_at,
      timetable_publication_events (
        id,
        event_type,
        from_status,
        to_status,
        note,
        performed_at
      )
    `)
    .eq('academic_period_id', academicPeriodId)
    .order('version_number', { ascending: false });

  if (error) {
    throw new Error(`Unable to load timetable versions: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    academicPeriodId: row.academic_period_id,
    versionNumber: row.version_number,
    status: row.status as TimetableVersion['status'],
    title: row.title,
    changeSummary: row.change_summary,
    sessionCount: row.session_count,
    conflictCount: row.conflict_count,
    snapshot: (row.snapshot ?? []) as unknown as PublishedSessionSnapshot[],
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    events: ((row.timetable_publication_events ?? []) as Array<{
      id: string;
      event_type: string;
      from_status: string | null;
      to_status: string;
      note: string | null;
      performed_at: string;
    }>).map((event): TimetablePublicationEvent => ({
      id: event.id,
      eventType: event.event_type,
      fromStatus: event.from_status,
      toStatus: event.to_status,
      note: event.note,
      performedAt: event.performed_at,
    })).sort((a, b) => b.performedAt.localeCompare(a.performedAt)),
  }));
});
