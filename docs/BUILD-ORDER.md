# HND App Timetable Build Order

The system is developed as complete vertical slices.

## Definition of complete

A feature is complete only when it has:

1. Database migration
2. Database constraints and indexes
3. Row-Level Security policies
4. TypeScript types
5. Zod validation
6. Queries and mutations
7. Create interface
8. Listing interface
9. Edit workflow
10. Archive workflow
11. Loading state
12. Empty state
13. Error state
14. Mobile and desktop support
15. Tests
16. Passing TypeScript, ESLint and production build
17. Git checkpoint

## Build sequence

1. Supabase connection
2. Authentication and HOD authorization
3. Application shell
4. Academic periods
5. Time slots and breaks
6. Rooms
7. Programmes
8. Cohorts
9. Units
10. Trainers
11. Unit offerings
12. Teaching allocations
13. Availability
14. Manual timetable editor
15. Conflict detection
16. Assisted generation
17. Approval and versioning
18. PDF and Excel export
19. Published timetable views
