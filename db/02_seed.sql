INSERT INTO config(key, value) VALUES
('metro.defaults', '{"line":"M1", "TimeZone":"Europe/Paris"}')
ON CONFLICT (key) DO NOTHING;

INSERT INTO config(key, value) VALUES
('metro.last', '{"chatelet":"00:58","Passy":"01:02"}')
ON CONFLICT (key) DO NOTHING;