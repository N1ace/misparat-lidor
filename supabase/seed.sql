-- Seed services (current menu)
insert into services (name, duration_minutes, price_agorot, sort_order) values
  ('תספורת גבר', 20, 8000, 1),
  ('סידור זקן ומסגרת', 10, 5000, 2),
  ('תספורת ועיצוב זקן', 30, 10000, 3),
  ('תספורת מספריים / שינוי', 40, 12000, 4);

-- Working hours (Google Business): Sun/Tue/Wed 09–21, Mon 10–21, Thu 09–22, Fri 08–16, Sat closed
insert into working_hours (day_of_week, open_time, close_time) values
  (0, '09:00', '21:00'),
  (1, '10:00', '21:00'),
  (2, '09:00', '21:00'),
  (3, '09:00', '21:00'),
  (4, '09:00', '22:00'),
  (5, '08:00', '16:00');
