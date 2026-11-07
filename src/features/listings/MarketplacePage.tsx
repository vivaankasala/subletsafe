import { Link, useSearchParams } from "react-router";
import {
  ArrowRight,
  Bath,
  BedDouble,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  House,
} from "lucide-react";
import { campuses, money, getSupabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { useQuery } from "../../lib/useQuery";
import { searchListings } from "./api";
import { Empty, Loading, Notice } from "../../components/ui";
import { ListingImages } from "./ListingImages";
export function MarketplacePage() {
  const { profile } = useAuth(),
    [params, setParams] = useSearchParams();
  const campus =
    params.get("campus") || profile?.target_university_id || campuses[0].id;
  const page = Math.max(0, Number(params.get("page")) || 0);
  const max = params.get("max") || "",
    from = params.get("from") || "",
    until = params.get("until") || "",
    type = params.get("type") || "",
    own = params.get("own") === "true";
  const invalidDates = !!from && !!until && from > until;
  const { data, error, loading } = useQuery(
    async () => {
      if (invalidDates) return [];
      if (own) {
        const { data, error } = await getSupabase()
          .from("housing_listings")
          .select("*")
          .eq("owner_id", profile!.id)
          .order("created_at", { ascending: false })
          .range(page * 12, page * 12 + 11);
        if (error) throw error;
        return data || [];
      }
      return searchListings(
        {
          campus,
          maxRentCents: max ? Math.round(Number(max) * 100) : undefined,
          from,
          until,
          propertyType: type,
        },
        page,
      );
    },
    JSON.stringify({
      campus,
      page,
      max,
      from,
      until,
      type,
      own,
      profile: profile?.id,
    }),
  );
  function change(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setParams(next);
  }
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">A SPACE FOR YOUR NEXT CHAPTER</span>
          <h1>{own ? "Your listings" : "Find your place."}</h1>
          <p>Sublets, open rooms and fresh starts around campus.</p>
        </div>
        <Link className="button" to="/housing/new">
          <Plus size={17} />
          Post a space
        </Link>
      </div>
      <div className="campus-tabs">
        {campuses.map((c) => (
          <button
            key={c.id}
            className={campus === c.id && !own ? "active" : ""}
            onClick={() => {
              const n = new URLSearchParams();
              n.set("campus", c.id);
              setParams(n);
            }}
          >
            <span className="campus-dot" />
            {c.name}
            <small>{c.city}</small>
          </button>
        ))}
        <button
          className={own ? "active" : ""}
          onClick={() => setParams({ own: "true" })}
        >
          My listings
        </button>
      </div>
      <div className="market-layout">
        <aside className="filter-panel">
          <div className="filter-heading">
            <h2>
              <Search size={17} />
              Your search
            </h2>
            <button
              className="plain small"
              onClick={() => setParams({ campus })}
            >
              Reset
            </button>
          </div>
          <label>
            Monthly budget
            <input
              type="number"
              min="0"
              max="100000"
              step="1"
              placeholder="Maximum rent ($)"
              value={max}
              onChange={(e) => change("max", e.target.value)}
            />
          </label>
          <label>
            Move-in date
            <input
              type="date"
              value={from}
              onChange={(e) => change("from", e.target.value)}
            />
          </label>
          <label>
            Stay until
            <input
              type="date"
              value={until}
              onChange={(e) => change("until", e.target.value)}
            />
          </label>
          <label>
            Space type
            <select
              value={type}
              onChange={(e) => change("type", e.target.value)}
            >
              <option value="">All spaces</option>
              <option value="room">Private room</option>
              <option value="apartment">Apartment</option>
              <option value="studio">Studio</option>
              <option value="house">House</option>
            </select>
          </label>
          <p className="fineprint">
            Date filters show spaces available for your entire stay.
          </p>
          <div className="safety-note">
            <ShieldCheck size={22} />
            <strong>A little caution goes a long way.</strong>
            <p>
              Visit the space and verify the agreement before sending any money.
            </p>
          </div>
        </aside>
        <section>
          <div className="results-heading">
            <span>
              {own
                ? "Your spaces"
                : campuses.find((c) => c.id === campus)?.city + " housing"}
            </span>
            <span className="muted">Newest first</span>
          </div>
          {invalidDates && (
            <Notice>Your end date must follow your move-in date.</Notice>
          )}
          {error && <Notice>{error}</Notice>}
          {loading ? (
            <Loading />
          ) : !data?.length ? (
            <Empty
              title={
                own
                  ? "Your first space starts here."
                  : "Good spaces are worth finding."
              }
              action={
                <Link className="button secondary" to="/housing/new">
                  Post the first space
                  <ArrowRight size={16} />
                </Link>
              }
            >
              {own
                ? "Have a room to share? Create a listing and introduce it to your campus."
                : "No spaces match this search yet. Try another date or help start the community with a listing."}
            </Empty>
          ) : (
            <div className="listing-grid">
              {data.map((l) => (
                <Link
                  className="listing-card"
                  key={l.id}
                  to={"/housing/" + l.id}
                >
                  <div className="listing-photo">
                    <ListingImages listingId={l.id} cover />
                    <span className="tag">
                      {l.status === "active" ? l.property_type : l.status}
                    </span>
                    <div className="photo-fallback">
                      <House size={40} />
                    </div>
                  </div>
                  <div className="listing-card-body">
                    <div className="price">
                      {money(l.monthly_rent)}
                      <span> / month</span>
                    </div>
                    <h2>{l.title}</h2>
                    <p>
                      <MapPin size={14} />
                      {l.approximate_location}
                    </p>
                    <div className="listing-facts">
                      <span>
                        <BedDouble size={15} />
                        {l.bedrooms} bed
                      </span>
                      <span>
                        <Bath size={15} />
                        {l.bathrooms} bath
                      </span>
                    </div>
                    <div className="listing-date">
                      Available {l.available_from}
                      {l.available_until
                        ? " → " + l.available_until
                        : " · Flexible end date"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {!!data?.length && (
            <div className="pagination">
              <button
                className="button secondary"
                disabled={page === 0}
                onClick={() =>
                  setParams({
                    ...Object.fromEntries(params),
                    page: String(page - 1),
                  })
                }
              >
                Previous
              </button>
              <span>Page {page + 1}</span>
              <button
                className="button secondary"
                disabled={data.length < 12}
                onClick={() =>
                  setParams({
                    ...Object.fromEntries(params),
                    page: String(page + 1),
                  })
                }
              >
                Next
              </button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
