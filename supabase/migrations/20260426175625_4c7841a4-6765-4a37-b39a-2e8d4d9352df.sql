UPDATE public.handle_geometries
SET path_json = '{"paths":[{"id":"main_handle","closed":false,"points":[{"x":281,"y":374,"width":60},{"x":382,"y":277,"width":60},{"x":484,"y":219,"width":60},{"x":585,"y":200,"width":60},{"x":686,"y":219,"width":60},{"x":788,"y":277,"width":60},{"x":889,"y":374,"width":60}]}]}'::jsonb,
    updated_at = now()
WHERE id = 'a90dcab4-7bf4-4ccd-96ab-7e3f8b8bb1c6';