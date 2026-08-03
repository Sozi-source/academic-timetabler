ACADEMIC TIMETABLER - UPDATED SRC

Changes included:
- Expected cohort completion is calculated from the configured Academic Period sequence.
- Completion date is read-only and recalculated by the server.
- Similar cohort units are detected and grouped into one shared Teaching Offering.
- Each cohort keeps its official unit and code.
- Clinical, attachment, exam and timetable-disabled offerings are not auto-shared.
- Forms are compact: helper paragraphs and most placeholders have been removed.
- Form actions use short labels such as Save, Import and Upload.

Apply:
1. Back up or commit the current project.
2. Extract this archive into the academic-timetabler project root.
3. Allow the src folder to merge and replace files.
4. Delete .next.
5. Run typecheck, tests, lint and build.

No Supabase migration is included.
