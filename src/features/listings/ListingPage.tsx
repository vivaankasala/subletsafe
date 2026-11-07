import { Link, useParams, useNavigate } from "react-router";
import {
  MapPin,
  BedDouble,
  Bath,
  ArrowLeft,
  MessageCircle,
} from "lucide-react";
import { getSupabase, money } from "../../lib/supabase";
import { useQuery } from "../../lib/useQuery";
import { useAuth } from "../auth/AuthProvider";
import { Loading, Notice, AsyncButton, Empty } from "../../components/ui";
import { SafetyControls } from "../safety/SafetyControls";
import { ListingImages } from "./ListingImages";
import type { Listing } from "./validation";
export function ListingPage() {
  const { id } = useParams(),
    navigate = useNavigate(),
    { session, profile } = useAuth();
  const { data, error, loading } = useQuery(async () => {
    const { data, error } = await getSupabase()
      .from("housing_listings")
      .select("*")
      .eq("id", id!)
      .maybeSingle();
    if (error) throw error;
    return data as Listing | null;
  }, id!);
  if (loading) return <Loading />;
  if (error) return <Notice>{error}</Notice>;
  if (!data)
    return (
      <Empty title="This space is unavailable.">
        It may have been filled, expired, or removed.
      </Empty>
    );
  const own = data.owner_id === session?.user.id;
  return (
    <>
      <Link className="back" to="/housing">
        <ArrowLeft size={16} />
        All spaces
      </Link>
      <div className="page-title">
        <div>
          <span className="eyebrow">
            {data.property_type} · {data.status}
          </span>
          <h1>{data.title}</h1>
          <p>
            <MapPin size={16} />
            {data.approximate_location} · Approximate area
          </p>
        </div>
        {own && (
          <Link className="button secondary" to={"/housing/" + id + "/edit"}>
            Edit listing
          </Link>
        )}
      </div>
      <div className="detail-layout">
        <div>
          <ListingImages listingId={id!} editable={own} />
          <section className="panel">
            <div className="listing-facts">
              <span>
                <BedDouble size={18} />
                {data.bedrooms} bedrooms
              </span>
              <span>
                <Bath size={18} />
                {data.bathrooms} bathrooms
              </span>
            </div>
            <h2>A little about the space</h2>
            <p className="preserve">{data.description}</p>
          </section>
        </div>
        <aside className="panel contact-card">
          <div className="big-price">
            {money(data.monthly_rent)}
            <small>/ month</small>
          </div>
          <hr />
          <strong>Available dates</strong>
          <p>
            {data.available_from} →{" "}
            {data.available_until || "Flexible end date"}
          </p>
          <p className="fineprint">
            Last confirmed{" "}
            {new Date(data.last_confirmed_at).toLocaleDateString()}
          </p>
          {!own &&
            (profile ? (
              <AsyncButton
                className="button full"
                action={async () => {
                  const { data: thread, error } = await getSupabase().rpc(
                    "start_conversation",
                    {
                      recipient: data.owner_id,
                      context_type: "listing",
                      context_id: id,
                    },
                  );
                  if (error) throw error;
                  void navigate("/messages/" + thread);
                }}
              >
                <MessageCircle size={17} />
                Ask about this space
              </AsyncButton>
            ) : (
              <Link className="button" to="/profile">
                Complete profile to contact
              </Link>
            ))}
          <div className="safety-note">
            <strong>Meet the space before the deposit.</strong>
            <p>
              Verify the property and agreement independently. SubletSafe
              doesn’t process payments or guarantee listings.
            </p>
          </div>
          {!own && <SafetyControls userId={data.owner_id} listingId={id} />}
        </aside>
      </div>
    </>
  );
}
