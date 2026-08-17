v12.8.9 rebuilds the Unit import RPC from the original local migration and
adds explicit public.import_batch_status casts. Remove the failed v12.8.8
migration before pushing, because it was never applied remotely.