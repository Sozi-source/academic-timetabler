-- ============================================================
-- Update venue / room capacities with specific rules:
-- HSD 1          -> 100
-- HSD 2          -> 150
-- HSD 3          -> 130
-- LH1 A & B      -> 120 each
-- LH 3 and 5     -> 100 each
-- THK2 9 and 10  -> 100 each
-- All other rooms -> 60
-- ============================================================

UPDATE public.rooms
SET capacity = CASE
      -- HSD 1 -> 100
      WHEN replace(replace(upper(code), ' ', ''), '-', '') = 'HSD1'
        OR replace(replace(upper(name), ' ', ''), '-', '') LIKE '%HSD1%' THEN 100

      -- HSD 2 -> 150
      WHEN replace(replace(upper(code), ' ', ''), '-', '') = 'HSD2'
        OR replace(replace(upper(name), ' ', ''), '-', '') LIKE '%HSD2%' THEN 150

      -- HSD 3 -> 130
      WHEN replace(replace(upper(code), ' ', ''), '-', '') = 'HSD3'
        OR replace(replace(upper(name), ' ', ''), '-', '') LIKE '%HSD3%' THEN 130

      -- LH1 A -> 120
      WHEN replace(replace(upper(code), ' ', ''), '-', '') = 'LH1A'
        OR replace(replace(upper(name), ' ', ''), '-', '') LIKE '%LH1A%' THEN 120

      -- LH1 B -> 120
      WHEN replace(replace(upper(code), ' ', ''), '-', '') = 'LH1B'
        OR replace(replace(upper(name), ' ', ''), '-', '') LIKE '%LH1B%' THEN 120

      -- LH 3 -> 100
      WHEN replace(replace(upper(code), ' ', ''), '-', '') = 'LH3'
        OR replace(replace(upper(name), ' ', ''), '-', '') LIKE '%LH3%' THEN 100

      -- LH 5 -> 100
      WHEN replace(replace(upper(code), ' ', ''), '-', '') = 'LH5'
        OR replace(replace(upper(name), ' ', ''), '-', '') LIKE '%LH5%' THEN 100

      -- THK2 9 -> 100
      WHEN replace(replace(upper(code), ' ', ''), '-', '') IN ('THK29', 'THK209')
        OR replace(replace(upper(name), ' ', ''), '-', '') LIKE '%THK29%'
        OR replace(replace(upper(name), ' ', ''), '-', '') LIKE '%THK209%' THEN 100

      -- THK2 10 -> 100
      WHEN replace(replace(upper(code), ' ', ''), '-', '') IN ('THK210', 'THK2-10')
        OR replace(replace(upper(name), ' ', ''), '-', '') LIKE '%THK210%' THEN 100

      -- All other venues -> 60
      ELSE 60
    END,
    updated_at = now();
