-- Sistema il tessuto "Velluto Beige" che ha slug vuoto, e qualunque altro record con slug NULL/''
UPDATE public.fabrics
SET slug = 'velluto-beige'
WHERE slug = '' AND name = 'Velluto Beige';

-- Per qualunque altro slug vuoto eventuale, generane uno univoco a partire dall'id
UPDATE public.fabrics
SET slug = 'tessuto-' || substring(id::text from 1 for 8)
WHERE slug IS NULL OR slug = '';