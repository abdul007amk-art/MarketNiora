DO $$
DECLARE
  function_name text;
  function_config text[];
  path_config text;
BEGIN
  FOREACH function_name IN ARRAY ARRAY[
    'reject_append_only_mutation',
    'reject_locked_formula_mutation',
    'enforce_owner_totp_owner_role'
  ]
  LOOP
    SELECT p.proconfig
      INTO function_config
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = function_name
      AND p.prorettype = 'trigger'::regtype;

    IF NOT FOUND OR function_config IS NULL THEN
      RAISE EXCEPTION 'Function % is missing or has no function settings', function_name;
    END IF;

    SELECT replace(split_part(cfg, '=', 2), '"', '')
      INTO path_config
    FROM unnest(function_config) AS setting(cfg)
    WHERE split_part(cfg, '=', 1) = 'search_path';

    IF NOT FOUND OR path_config <> '' THEN
      RAISE EXCEPTION 'Function % must have an explicitly empty search_path, current config=%', function_name, function_config;
    END IF;
  END LOOP;
END
$$;
