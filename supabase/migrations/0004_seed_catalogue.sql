-- ============================================================================
-- LAKE FLAVOUR — migration 0004: seed the Fried Omena catalogue
-- ----------------------------------------------------------------------------
-- Idempotent: upserts by slug / (product_id, option_key). Running it twice
-- leaves the same data.
--
-- NOTE FOR THE OWNER: re-running this file resets prices and names to the
-- catalogue defaults and resets stock_quantity to 50 per option. Stock is
-- managed in the owner dashboard (Step 4B) — you normally only run this once.
-- ============================================================================

-- Product row (matches the copy in lib/products.ts — the fallback catalogue).
insert into public.products
  (slug, name, tagline, description, highlights, images, badge, is_active)
values
  (
    'fried-omena',
    'Fried Omena',
    'Fresh from Lake Victoria',
    'Fresh fried omena from Lake Victoria, washed to remove stones and shell, fried in fresh vegetable oil and prepared to your taste.',
    '["Sourced from Lake Victoria",
     "Washed to remove stones and shell",
     "Fried in fresh vegetable oil",
     "Prepared to your taste"]'::jsonb,
    '[{"src": "/images/landing/hero-1.webp",
        "alt": "A bag of Lake Flavour fried omena standing on a wooden board"},
       {"src": "/images/landing/hero-5.webp",
        "alt": "Bag of fried omena with a chef, knife and chillies in the kitchen"}]'::jsonb,
    null,   -- badge: none yet
    true
  )
on conflict (slug) do update
  set name        = excluded.name,
      tagline     = excluded.tagline,
      description = excluded.description,
      highlights  = excluded.highlights,
      images      = excluded.images,
      badge       = excluded.badge,
      is_active   = true;

-- Sizes and prices. Stock starts at 50 per option (the owner edits real
-- stock in the owner dashboard, Step 4B).
insert into public.product_options
  (product_id, option_key, label, local_name, price_kes, stock_quantity, is_active)
select
  p.id,
  v.option_key,
  v.label,
  v.local_name,
  v.price_kes,
  v.stock_quantity,
  true
from public.products p
cross join (values
  ('1kg', '1 kg', 'Half gorogoro', 400, 50),
  ('2kg', '2 kg', '1 gorogoro',    800, 50)
) as v(option_key, label, local_name, price_kes, stock_quantity)
where p.slug = 'fried-omena'
on conflict (product_id, option_key) do update
  set label         = excluded.label,
      local_name    = excluded.local_name,
      price_kes     = excluded.price_kes,
      stock_quantity = 50,   -- seed reset (see note above)
      is_active     = true;
