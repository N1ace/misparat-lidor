-- Replace service menu with client-provided list
update services set active = false;

insert into services (name, duration_minutes, price_agorot, sort_order, active) values
  ('תספורת גבר', 20, 8000, 1, true),
  ('סידור זקן ומסגרת', 10, 5000, 2, true),
  ('תספורת ועיצוב זקן', 30, 10000, 3, true),
  ('תספורת מספריים / שינוי', 40, 12000, 4, true);
