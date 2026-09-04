
update public.businesses set
  name = 'VDS Mobile',
  legal_name = 'Valet Detailing Service LLC',
  timezone = 'America/New_York',
  support_email = 'valetdetailingservice@gmail.com',
  support_phone = '+14709446485',
  brand_primary = '#0a0a0a',
  brand_accent = '#d4af37'
where id = '67300538-c50b-4f7a-9bfe-374cdfbe966c';

insert into public.services (business_id, name, description, base_price_cents, duration_minutes, is_active, sort_order) values
('67300538-c50b-4f7a-9bfe-374cdfbe966c','Full Detail','Interior and exterior restoration, odor and stain removal, professional products, ceramic sealant.',25000,150,true,1),
('67300538-c50b-4f7a-9bfe-374cdfbe966c','Exterior Detail','Hand wash of rims, barrels and all panels, door jambs, exterior glass, tire dress and ceramic sealant.',11500,90,true,2),
('67300538-c50b-4f7a-9bfe-374cdfbe966c','Interior Detail','Steam clean of all surfaces, deep vacuum, interior glass, dashboard, door panels, seats, floors and mats.',15000,120,true,3),
('67300538-c50b-4f7a-9bfe-374cdfbe966c','Ceramic Sealant (3 Month)','Three month hydrophobic sealant applied over corrected paint.',5000,30,true,4),
('67300538-c50b-4f7a-9bfe-374cdfbe966c','Engine Bay Detail','Degrease, clean and dress of the engine bay.',5000,30,true,5),
('67300538-c50b-4f7a-9bfe-374cdfbe966c','Headlight Restoration','Wet sand, polish and seal of oxidised headlight lenses.',10000,45,true,6),
('67300538-c50b-4f7a-9bfe-374cdfbe966c','Pet Hair Removal','Dedicated extraction of embedded pet hair from carpets and upholstery.',5000,30,true,7),
('67300538-c50b-4f7a-9bfe-374cdfbe966c','Ceramic Coating Consultation','Free fifteen minute consultation, custom quote on site. Two to seven year coatings.',0,15,true,8),
('67300538-c50b-4f7a-9bfe-374cdfbe966c','Paint Correction Consultation','Free fifteen minute consultation, custom quote on site. Swirl and scratch removal.',0,15,true,9);

grant insert on public.bookings to anon;

create policy "public may request a booking on an active tenant"
  on public.bookings for insert to anon
  with check (
    status = 'pending'::booking_status
    and customer_id is null
    and specialist_id is null
    and total_cents >= 0
    and exists (
      select 1 from public.businesses b
      where b.id = bookings.business_id
        and b.is_active
        and b.lifecycle = 'active'::business_lifecycle
    )
  );
