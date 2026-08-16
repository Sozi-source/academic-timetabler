# Database migrations

The SQL migrations are in the `migrations` folder and must be applied in filename order, from the oldest timestamp to the newest.

## Supabase CLI

After linking the project, run:

```bash
supabase db push
```

## Supabase dashboard

If you are applying them manually, open the SQL Editor and run each `.sql` file in ascending filename order. Do not skip a file because later migrations depend on earlier tables and functions.

Keep database credentials in `.env.local`; do not add them to the project archive.
