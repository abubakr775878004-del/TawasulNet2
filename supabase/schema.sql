-- ============================================
-- قاعدة بيانات موقع "تواصل" لإدارة وتوزيع الكروت
-- شغّل هذا الملف كاملاً مرة واحدة داخل:
-- Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ============================================

-- 1) جدول الملفات الشخصية (يرتبط بنظام تسجيل الدخول الجاهز في Supabase)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'distributor' check (role in ('admin','distributor')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  balance numeric not null default 0,
  created_at timestamptz not null default now()
);

-- 2) جدول الباقات
create table packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric not null,
  created_at timestamptz not null default now()
);

-- 3) جدول الكروت (رقم الكرت تسلسلي بدون فواصل)
create table cards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  package_id uuid not null references packages(id),
  status text not null default 'available' check (status in ('available','with_distributor','sold')),
  assigned_to uuid references profiles(id),
  sold_at timestamptz,
  created_at timestamptz not null default now()
);

-- 4) جدول طلبات الكروت من الموزعين
create table card_requests (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references profiles(id),
  package_id uuid not null references packages(id),
  quantity int not null,
  status text not null default 'pending' check (status in ('pending','fulfilled','rejected')),
  created_at timestamptz not null default now()
);

-- ============================================
-- تفعيل الحماية على مستوى الصفوف (كل موزع يشوف بياناته فقط)
-- ============================================
alter table profiles enable row level security;
alter table packages enable row level security;
alter table cards enable row level security;
alter table card_requests enable row level security;

-- المستخدم يشوف ملفه الشخصي فقط، والأدمن يشوف الكل
create policy "profiles_self_select" on profiles for select
  using (auth.uid() = id or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "profiles_self_update" on profiles for update
  using (auth.uid() = id);

-- الباقات يشوفها الجميع المسجلين دخول
create policy "packages_select_all" on packages for select
  using (auth.role() = 'authenticated');

-- الأدمن فقط يضيف/يعدل باقات
create policy "packages_admin_write" on packages for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- الكروت: الموزع يشوف الكروت المخصصة له فقط، الأدمن يشوف الكل
create policy "cards_select_own" on cards for select
  using (
    assigned_to = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "cards_admin_write" on cards for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- الطلبات: الموزع يشوف طلباته فقط، الأدمن يشوف الكل
create policy "requests_select_own" on card_requests for select
  using (
    distributor_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "requests_insert_own" on card_requests for insert
  with check (distributor_id = auth.uid());

create policy "requests_admin_update" on card_requests for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ============================================
-- دوال آمنة لتنفيذ العمليات الحساسة (رصيد، تعيين كروت) بشكل ذري
-- ============================================

-- تنفيذ طلب موزع: يعيّن الكروت المتاحة له ويخصم من رصيده
create or replace function fulfill_request(req_id uuid)
returns void as $$
declare
  r card_requests%rowtype;
  pkg_price numeric;
  total numeric;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception 'غير مصرح لك بتنفيذ هذا الإجراء';
  end if;

  select * into r from card_requests where id = req_id and status = 'pending';
  if not found then
    raise exception 'الطلب غير موجود أو تم تنفيذه مسبقًا';
  end if;

  select price into pkg_price from packages where id = r.package_id;
  total := pkg_price * r.quantity;

  if (select balance from profiles where id = r.distributor_id) < total then
    raise exception 'رصيد الموزع غير كافٍ لتنفيذ هذا الطلب';
  end if;

  if (select count(*) from cards where package_id = r.package_id and status = 'available') < r.quantity then
    raise exception 'عدد الكروت المتاحة في المخزون غير كافٍ';
  end if;

  update cards set status = 'with_distributor', assigned_to = r.distributor_id
  where id in (
    select id from cards where package_id = r.package_id and status = 'available'
    order by created_at asc
    limit r.quantity
  );

  update profiles set balance = balance - total where id = r.distributor_id;
  update card_requests set status = 'fulfilled' where id = req_id;
end;
$$ language plpgsql security definer;

-- رفض طلب موزع
create or replace function reject_request(req_id uuid)
returns void as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception 'غير مصرح لك بتنفيذ هذا الإجراء';
  end if;
  update card_requests set status = 'rejected' where id = req_id and status = 'pending';
end;
$$ language plpgsql security definer;

-- الموزع يعلّم كرت أنه تم بيعه (يبدأ عدّاد الـ24 ساعة)
create or replace function sell_card(c_id uuid)
returns void as $$
begin
  update cards set status = 'sold', sold_at = now()
  where id = c_id and status = 'with_distributor' and assigned_to = auth.uid();
end;
$$ language plpgsql security definer;

grant execute on function fulfill_request(uuid) to authenticated;
grant execute on function reject_request(uuid) to authenticated;
grant execute on function sell_card(uuid) to authenticated;

