insert into public.universities(id,name,slug,email_domains,city) values
('11111111-1111-4111-8111-111111111111','University of Michigan','umich',array['umich.edu'],'Ann Arbor'),
('22222222-2222-4222-8222-222222222222','Michigan State University','msu',array['msu.edu'],'East Lansing') on conflict(slug) do nothing;
