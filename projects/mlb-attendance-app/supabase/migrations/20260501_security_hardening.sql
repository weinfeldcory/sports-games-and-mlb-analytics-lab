create index if not exists attendance_logs_user_id_idx
on public.attendance_logs (user_id);

create index if not exists attendance_logs_user_id_attended_on_idx
on public.attendance_logs (user_id, attended_on desc);
