-- Align booking windows with Google Business hours for מספרת לידור
delete from working_hours;

insert into working_hours (day_of_week, open_time, close_time) values
  (0, '09:00', '21:00'),
  (1, '10:00', '21:00'),
  (2, '09:00', '21:00'),
  (3, '09:00', '21:00'),
  (4, '09:00', '22:00'),
  (5, '08:00', '16:00');
