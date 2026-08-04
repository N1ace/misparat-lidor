-- Seed services
insert into services (name, duration_minutes, price_agorot, sort_order) values
  ('תספורת גברים', 30, 8000, 1),
  ('עיצוב זקן', 20, 5000, 2),
  ('תספורת + זקן', 45, 11000, 3),
  ('תספורת ילדים', 25, 6000, 4),
  ('שטיפה ועיצוב', 20, 4000, 5);

-- Working hours: Sun–Thu 09:00–19:00, Fri 09:00–14:00 (Sat closed — no row)
insert into working_hours (day_of_week, open_time, close_time) values
  (0, '09:00', '19:00'),
  (1, '09:00', '19:00'),
  (2, '09:00', '19:00'),
  (3, '09:00', '19:00'),
  (4, '09:00', '19:00'),
  (5, '09:00', '14:00');
