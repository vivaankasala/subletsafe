import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
const db = new PGlite();
const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  c = "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  u = "11111111-1111-4111-8111-111111111111";
async function as(id: string, sql: string, params: unknown[] = []) {
  await db.exec(
    `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false)`,
  );
  return db.query(sql, params);
}
beforeAll(async () => {
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; alter default privileges in schema public grant all on tables to anon,authenticated,service_role; alter default privileges in schema public grant execute on functions to anon,authenticated,service_role; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security; create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`,
  );
  for (const file of readdirSync("supabase/migrations")
    .filter((x) => x.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  await db.exec(
    `insert into auth.users values ('${a}','a@umich.edu',now()),('${b}','b@msu.edu',now()),('${c}','c@example.com',null); insert into public.universities(id,name,slug,email_domains,city) values ('${u}','Michigan','umich',array['umich.edu','msu.edu'],'Ann Arbor') on conflict do nothing;insert into public.pilot_invites(email) values ('a@umich.edu'),('b@msu.edu');`,
  );
}, 60000);
afterAll(() => db.close());
it("allows transfer onboarding but prevents cross-user updates and unconfirmed browsing", async () => {
  await as(
    a,
    `insert into profiles(id,display_name,university_id,target_university_id) values ($1,'Alex',$2,$2)`,
    [a, u],
  );
  await as(
    b,
    `insert into profiles(id,display_name,university_id,target_university_id,seeking_roommate) values ($1,'Blair',$2,$2,true)`,
    [b, u],
  );
  expect(
    (await as(a, "select display_name from profiles where id=$1", [b])).rows,
  ).toHaveLength(1);
  expect(
    (
      await as(
        a,
        `update profiles set display_name='hacked' where id=$1 returning id`,
        [b],
      )
    ).rows,
  ).toHaveLength(0);
  expect(
    (await as(c, "select * from profiles where id=$1", [b])).rows,
  ).toHaveLength(0);
  await expect(as(a, "select * from moderator_roles")).rejects.toThrow();
});
it("excludes unconfirmed and non-university recipients from discovery and contact", async () => {
  await expect(
    as(
      c,
      `insert into profiles(id,display_name,university_id,target_university_id,seeking_roommate) values ($1,'Draft',$2,$2,true)`,
      [c, u],
    ),
  ).rejects.toThrow();
  await as(
    c,
    `insert into profiles(id,display_name,university_id,target_university_id) values ($1,'Draft',$2,$2)`,
    [c, u],
  );
  expect(
    (await as(a, "select id from profiles where id=$1", [c])).rows,
  ).toHaveLength(0);
  await expect(
    as(a, `select start_conversation($1,'profile',$1)`, [c]),
  ).rejects.toThrow();
  await db.exec(
    `reset role;update auth.users set email_confirmed_at=now() where id='${c}'`,
  );
  expect(
    (await as(a, "select id from profiles where id=$1", [c])).rows,
  ).toHaveLength(0);
});
it("keeps a confirmed university account outside the pilot until invited", async () => {
  await db.exec(
    `reset role; update auth.users set email='c@umich.edu',email_confirmed_at=now() where id='${c}'`,
  );
  expect(
    (await as(c, "select is_confirmed_member() as allowed")).rows[0],
  ).toEqual({ allowed: false });
  expect(
    (await as(c, "select id from profiles where id=$1", [a])).rows,
  ).toHaveLength(0);
});
it("keeps drafts private and enforces ownership", async () => {
  const row = await as(
    a,
    `insert into housing_listings(owner_id,university_id,title,description,monthly_rent,approximate_location,property_type,available_from) values ($1,$2,'Sunny room','A furnished room close to campus',85000,'Central Campus','room',current_date) returning id`,
    [a, u],
  );
  const id = (row.rows[0] as { id: string }).id;
  expect(
    (await as(b, "select * from housing_listings where id=$1", [id])).rows,
  ).toHaveLength(0);
  await as(a, `update housing_listings set status='active' where id=$1`, [id]);
  expect(
    (await as(b, "select * from housing_listings where id=$1", [id])).rows,
  ).toHaveLength(1);
  expect(
    (
      await as(
        b,
        `update housing_listings set monthly_rent=1 where id=$1 returning id`,
        [id],
      )
    ).rows,
  ).toHaveLength(0);
  await as(a, `update housing_listings set status='unavailable' where id=$1`, [
    id,
  ]);
  expect(
    (await as(b, "select * from housing_listings where id=$1", [id])).rows,
  ).toHaveLength(0);
});
it("creates one thread on retry, rejects outsiders and blocks messages in both directions", async () => {
  const one = await as(a, `select start_conversation($1,'profile',$1) as id`, [
    b,
  ]);
  const id = (one.rows[0] as { id: string }).id;
  expect(
    (await as(a, `select start_conversation($1,'profile',$1) as id`, [b]))
      .rows[0],
  ).toEqual({ id });
  await as(
    a,
    `select send_message($1,'11111111-2222-4333-8444-555555555555','Hello!')`,
    [id],
  );
  await as(
    a,
    `select send_message($1,'11111111-2222-4333-8444-555555555555','Hello!')`,
    [id],
  );
  expect(
    (await as(b, "select * from messages where conversation_id=$1", [id])).rows,
  ).toHaveLength(1);
  expect(
    (await as(c, "select * from messages where conversation_id=$1", [id])).rows,
  ).toHaveLength(0);
  await expect(
    as(c, `select send_message($1,gen_random_uuid(),'Intruder')`, [id]),
  ).rejects.toThrow();
  await as(b, "insert into blocks(blocker_id,blocked_id) values ($1,$2)", [
    b,
    a,
  ]);
  await expect(
    as(a, `select send_message($1,gen_random_uuid(),'Blocked')`, [id]),
  ).rejects.toThrow();
  await expect(
    as(b, `select send_message($1,gen_random_uuid(),'Also blocked')`, [id]),
  ).rejects.toThrow();
  expect(
    (await as(a, "select * from profiles where id=$1", [b])).rows,
  ).toHaveLength(0);
  expect(
    (await as(b, "select * from messages where conversation_id=$1", [id])).rows,
  ).toHaveLength(1);
  await as(b, "delete from blocks where blocker_id=$1", [b]);
});
it("keeps reports private and prevents forged moderation", async () => {
  await as(
    a,
    `insert into reports(reporter_id,reported_user_id,reason,details) values ($1,$2,'misleading','Please review')`,
    [a, b],
  );
  expect((await as(b, "select * from reports")).rows).toHaveLength(0);
  await expect(
    as(a, `insert into moderator_roles(user_id) values ($1)`, [a]),
  ).rejects.toThrow();
  await expect(
    as(a, `update profiles set restricted=true where id=$1`, [a]),
  ).rejects.toThrow();
});

it("can report an otherwise accessible listing after blocking its owner", async () => {
  await as(a, `update housing_listings set status='active' where owner_id=$1`, [
    a,
  ]);
  const listing = await as(b, "select id from housing_listings limit 1");
  const id = (listing.rows[0] as { id: string }).id;
  await as(b, "insert into blocks(blocker_id,blocked_id) values ($1,$2)", [
    b,
    a,
  ]);
  await as(
    b,
    `insert into reports(reporter_id,reported_user_id,listing_id,reason,details) values ($1,$2,$3,'harassment','Blocked then reported')`,
    [b, a, id],
  );
  await as(b, "delete from blocks where blocker_id=$1", [b]);
});
it("atomically caps photos at eight and reuses a reservation on retry", async () => {
  await db.exec("reset role");
  const rows = await db.query<{ id: string }>(
    `select id from housing_listings where owner_id=$1 limit 1`,
    [a],
  );
  const listing = rows.rows[0].id;
  await db.exec("set role service_role");
  let first = "";
  for (let i = 0; i < 8; i++) {
    const request = `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
    const r = await db.query<{ id: string }>(
      `select (reserve_listing_image($1,$2,$3)).id`,
      [a, listing, request],
    );
    if (i === 0) first = r.rows[0].id;
  }
  expect(
    (
      await db.query<{ id: string }>(
        `select (reserve_listing_image($1,$2,$3)).id`,
        [a, listing, first],
      )
    ).rows[0].id,
  ).toBe(first);
  await expect(
    db.query(`select reserve_listing_image($1,$2,gen_random_uuid())`, [
      a,
      listing,
    ]),
  ).rejects.toThrow(/8 photos/);
  await expect(
    db.query(`select reserve_listing_image($1,$2,gen_random_uuid())`, [
      b,
      listing,
    ]),
  ).rejects.toThrow(/unavailable/);
  await expect(
    as(a, `select reserve_listing_image($1,$2,gen_random_uuid())`, [
      a,
      listing,
    ]),
  ).rejects.toThrow();
});
it("reorders photos atomically and rejects another owner", async () => {
  await db.exec("reset role; update listing_images set ready=true");
  const images = await db.query<{ id: string }>(
    "select id from listing_images order by display_order",
  );
  const first = images.rows[0].id,
    second = images.rows[1].id;
  await expect(
    as(b, "select move_listing_image($1,1)", [first]),
  ).rejects.toThrow();
  await as(a, "select move_listing_image($1,1)", [first]);
  expect(
    (
      await as(
        a,
        "select id from listing_images order by display_order limit 2",
      )
    ).rows,
  ).toEqual([{ id: second }, { id: first }]);
});
it("exposes only reporter-selected message evidence through audited moderator access", async () => {
  const messages = await as(
    a,
    "select id,conversation_id from messages order by created_at limit 1",
  );
  const msg = messages.rows[0] as { id: string; conversation_id: string };
  const inserted = await as(
    a,
    `insert into reports(reporter_id,reported_user_id,conversation_id,reason,details,evidence_message_ids) values ($1,$2,$3,'harassment','Review selected evidence',array[$4::uuid]) returning id`,
    [a, b, msg.conversation_id, msg.id],
  );
  const report = (inserted.rows[0] as { id: string }).id;
  await expect(as(b, "select get_report_detail($1)", [report])).rejects.toThrow(
    /Moderator/,
  );
  await db.exec(`reset role;insert into moderator_roles values ('${a}')`);
  const detail = await as(a, "select get_report_detail($1) as detail", [
    report,
  ]);
  const value = (
    detail.rows[0] as { detail: { evidence: { content: string }[] } }
  ).detail;
  expect(value.evidence).toHaveLength(1);
  expect(value.evidence[0].content).toBe("Hello!");
  expect(
    (await as(a, `select * from moderation_actions where action='inspect'`))
      .rows,
  ).toHaveLength(1);
  await db.exec("reset role;delete from moderator_roles");
});
it("enforces message rate limits and rejects changed retry payloads", async () => {
  const thread = await as(
    a,
    `select start_conversation($1,'profile',$1) as id`,
    [b],
  );
  const id = (thread.rows[0] as { id: string }).id;
  await expect(
    as(
      a,
      `select send_message($1,'11111111-2222-4333-8444-555555555555','Different')`,
      [id],
    ),
  ).rejects.toThrow(/Retry/);
  await db.exec("reset role; truncate write_limits");
  for (let i = 0; i < 20; i++)
    await as(a, `select send_message($1,gen_random_uuid(),'A message')`, [id]);
  await expect(
    as(a, `select send_message($1,gen_random_uuid(),'One too many')`, [id]),
  ).rejects.toThrow(/Too many/);
});
it("rejects fabricated measurement targets and private eligibility probes", async () => {
  await expect(as(c, "select member_eligible($1)", [a])).rejects.toThrow();
  await expect(
    as(
      a,
      `insert into pilot_events(user_id,event,entity_id) values($1,'listing_published',gen_random_uuid())`,
      [a],
    ),
  ).rejects.toThrow();
  const threads = await as(a, "select id from conversations limit 1");
  await as(
    a,
    `insert into pilot_events(user_id,event,entity_id) values($1,'connection_confirmed',$2)`,
    [a, (threads.rows[0] as { id: string }).id],
  );
});
it("requires moderator authorization and audits a real restriction", async () => {
  const reports = await as(a, "select id from reports limit 1");
  const id = (reports.rows[0] as { id: string }).id;
  await expect(
    as(a, `select moderate_report($1,'restrict_user','Reviewed evidence')`, [
      id,
    ]),
  ).rejects.toThrow(/Moderator/);
  await db.exec(`reset role; insert into moderator_roles values ('${a}')`);
  await as(
    a,
    `select moderate_report($1,'restrict_user','Reviewed evidence')`,
    [id],
  );
  expect(
    (
      await as(
        a,
        "select * from moderation_actions where action='restrict_user'",
      )
    ).rows,
  ).toHaveLength(1);
  await expect(
    as(
      b,
      `insert into housing_listings(owner_id,university_id,title,description,monthly_rent,approximate_location,property_type,available_from) values ($1,$2,'Blocked','A room',1,'Campus','room',current_date)`,
      [b, u],
    ),
  ).rejects.toThrow();
});
it("hides a deletion requester immediately without deleting conversation evidence", async () => {
  await as(a, "select request_deletion()");
  await db.exec("reset role");
  expect(
    (
      await db.query<{ deleted_at: string }>(
        "select deleted_at from profiles where id=$1",
        [a],
      )
    ).rows[0].deleted_at,
  ).toBeTruthy();
  expect(
    (await db.query("select * from messages")).rows.length,
  ).toBeGreaterThan(0);
  expect((await as(a, "select is_confirmed_member() as ok")).rows[0]).toEqual({
    ok: false,
  });
});
