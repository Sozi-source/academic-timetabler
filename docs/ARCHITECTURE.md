# HND App Architecture

## Current scope

The first operational module is the Department Timetabler.

Other academic modules will be introduced only after the timetable module is stable.

## Architecture

HND App uses a modular monolith:

- `app` contains routes and page composition.
- `components` contains reusable visual components.
- `features` contains business workflows.
- `lib` contains infrastructure and timetable logic.
- `types` contains shared domain definitions.
- `supabase` contains database migrations and seeds.
- `tests` contains business-rule and interface tests.

## Development principle

Complete one vertical slice before beginning another.

For example, Academic Periods must include its database table, security, validation, create, list, edit, archive, tests and quality checks before Time Slots begin.
