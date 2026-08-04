-- Allow reschedule notifications in outbox
alter table outbox drop constraint if exists outbox_kind_check;
alter table outbox add constraint outbox_kind_check
  check (kind in ('confirmation','reminder','cancellation','reschedule'));
