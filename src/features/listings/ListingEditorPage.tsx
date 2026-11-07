import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { campuses, getSupabase, errorMessage } from "../../lib/supabase";
import { useQuery } from "../../lib/useQuery";
import { Loading, Notice } from "../../components/ui";
import { dollarsToCents, type Listing } from "./validation";
import { trackEvent } from "../../lib/events";
import { saveListing } from "./api";
import { ListingImages } from "./ListingImages";
export function ListingEditorPage() {
  const { id } = useParams();
  const { profile } = useAuth();
  const { data, error, loading } = useQuery(async () => {
    if (!id) return null;
    const { data, error } = await getSupabase()
      .from("housing_listings")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as Listing;
  }, id || "new");
  if (id && loading) return <Loading />;
  if (error) return <Notice>{error}</Notice>;
  if (!profile)
    return (
      <div className="setup-card">
        <h1>Introduce yourself first.</h1>
        <p>Complete your profile before posting a space.</p>
        <Link className="button" to="/profile">
          Create profile
        </Link>
      </div>
    );
  if (data && data.owner_id !== profile.id)
    return <Notice>Only the listing owner can edit this space.</Notice>;
  return <ListingForm key={id || "new"} listing={data || undefined} />;
}
function ListingForm({ listing }: { listing?: Listing }) {
  const { profile } = useAuth(),
    navigate = useNavigate();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const l = await saveListing(
        {
          title: String(f.get("title")),
          description: String(f.get("description")),
          university_id: String(f.get("university_id")),
          monthly_rent: dollarsToCents(String(f.get("monthly_rent"))),
          approximate_location: String(f.get("approximate_location")),
          property_type: String(f.get("property_type")),
          available_from: String(f.get("available_from")),
          available_until: String(f.get("available_until")) || null,
          bedrooms: Number(f.get("bedrooms")),
          bathrooms: Number(f.get("bathrooms")),
          status: String(f.get("status")),
        },
        listing?.id,
      );
      if (l.status === "active")
        await trackEvent({ event: "listing_published", entity_id: l.id });
      void navigate("/housing/" + l.id);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="narrow">
      <span className="eyebrow">MAKE ROOM FOR SOMEONE NEW</span>
      <h1>{listing ? "Edit your space." : "Share your space."}</h1>
      <p className="muted">Clear details help the right person find you.</p>
      <form className="panel form-grid" onSubmit={save}>
        <label className="span2">
          Listing title
          <input
            name="title"
            defaultValue={listing?.title}
            placeholder="Sunny room near Central Campus"
            maxLength={120}
            required
          />
        </label>
        <label>
          Campus
          <select
            name="university_id"
            defaultValue={
              listing?.university_id || profile?.target_university_id
            }
          >
            {campuses.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Monthly rent ($)
          <input
            name="monthly_rent"
            type="number"
            step="0.01"
            min="0"
            max="100000"
            defaultValue={listing ? listing.monthly_rent / 100 : undefined}
            required
          />
        </label>
        <label>
          Approximate area
          <input
            name="approximate_location"
            placeholder="e.g. Kerrytown"
            defaultValue={listing?.approximate_location}
            maxLength={120}
            required
          />
        </label>
        <label>
          Space type
          <select
            name="property_type"
            defaultValue={listing?.property_type || "room"}
          >
            {["room", "apartment", "studio", "house"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Available from
          <input
            type="date"
            name="available_from"
            defaultValue={listing?.available_from}
            required
          />
        </label>
        <label>
          Available until (optional)
          <input
            type="date"
            name="available_until"
            defaultValue={listing?.available_until || ""}
          />
        </label>
        <label>
          Bedrooms
          <input
            type="number"
            name="bedrooms"
            min="0"
            max="20"
            defaultValue={listing?.bedrooms ?? 1}
            required
          />
        </label>
        <label>
          Bathrooms
          <input
            type="number"
            name="bathrooms"
            min="0"
            max="20"
            step="0.5"
            defaultValue={listing?.bathrooms ?? 1}
            required
          />
        </label>
        <label className="span2">
          About the space
          <textarea
            name="description"
            rows={5}
            maxLength={5000}
            defaultValue={listing?.description}
            placeholder="Tell people about rent, utilities, roommates and lease requirements. Leave out exact addresses and private contact details."
            required
          />
        </label>
        <label className="span2">
          Availability status
          <select name="status" defaultValue={listing?.status || "draft"}>
            <option value="draft">Draft — only you can see it</option>
            <option value="active">Active — ready for inquiries</option>
            <option value="unavailable">Unavailable — hide from search</option>
          </select>
        </label>
        <p className="fineprint span2">
          Only post housing you have permission to offer. Publishing confirms
          that availability is current; reconfirm it at least every 30 days.
        </p>
        {error && (
          <div className="span2">
            <Notice>{error}</Notice>
          </div>
        )}
        <button className="button span2" disabled={busy}>
          {busy ? "Saving…" : "Save listing"}
        </button>
      </form>
      {listing ? (
        <section className="panel">
          <h2>Listing photos</h2>
          <ListingImages listingId={listing.id} editable />
        </section>
      ) : (
        <p className="fineprint">
          Save a draft first, then add photos from the listing page.
        </p>
      )}
    </div>
  );
}
