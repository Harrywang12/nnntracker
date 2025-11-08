-- Security hardening: enforce user ownership and prevent abuse
-- Idempotent: safe to run multiple times

-- 1) Ensure detections.user_id always equals auth.uid()
create or replace function public.enforce_user_id_match()
returns trigger as $$
begin
  if NEW.user_id is null or NEW.user_id <> auth.uid() then
    raise exception 'user_id must match authenticated user';
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists enforce_user_id_detections on public.detections;
create trigger enforce_user_id_detections
before insert or update on public.detections
for each row
execute function public.enforce_user_id_match();

-- 2) Set detections.email from auth.users server-side to avoid spoofing
create or replace function public.set_detection_email()
returns trigger as $$
declare
  user_email text;
begin
  select email into user_email
  from auth.users
  where id = NEW.user_id;
  NEW.email := user_email;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists set_detection_email_trigger on public.detections;
create trigger set_detection_email_trigger
before insert on public.detections
for each row
execute function public.set_detection_email();

-- 3) Prevent duplicate detections per day per user (rate limit)
create unique index if not exists detections_user_date_unique
on public.detections (user_id, date);

-- 4) Ensure user_id is not null
do $$
begin
  if not exists (
    select 1
    from information_schema.constraint_column_usage ccu
    join information_schema.table_constraints tc
      on tc.constraint_name = ccu.constraint_name
     and tc.table_schema = ccu.table_schema
    where tc.table_schema = 'public'
      and tc.table_name = 'detections'
      and tc.constraint_type = 'CHECK'
      and ccu.column_name = 'user_id'
  ) then
    alter table public.detections
    add constraint detections_user_id_not_null check (user_id is not null);
  end if;
end $$;

-- 5) Ensure user_profiles.id always equals auth.uid()
create or replace function public.enforce_profile_user_id()
returns trigger as $$
begin
  if NEW.id is null or NEW.id <> auth.uid() then
    raise exception 'profile id must match authenticated user';
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists enforce_profile_user_id_trigger on public.user_profiles;
create trigger enforce_profile_user_id_trigger
before insert or update on public.user_profiles
for each row
execute function public.enforce_profile_user_id();

-- 6) Optional: username change cooldown (24h)
alter table public.user_profiles
add column if not exists username_changed_at timestamptz;

create or replace function public.check_username_cooldown()
returns trigger as $$
begin
  if TG_OP = 'UPDATE'
     and OLD.username is not null
     and OLD.username <> NEW.username
     and OLD.username_changed_at is not null
     and OLD.username_changed_at > now() - interval '24 hours' then
    raise exception 'Username can only be changed once per 24 hours';
  end if;
  if TG_OP = 'UPDATE' and (OLD.username is null or OLD.username <> NEW.username) then
    NEW.username_changed_at := now();
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists check_username_cooldown_trigger on public.user_profiles;
create trigger check_username_cooldown_trigger
before update on public.user_profiles
for each row
execute function public.check_username_cooldown();


