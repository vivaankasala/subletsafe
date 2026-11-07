import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { ArrowRight, MessageCircle, Send } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { getSupabase, errorMessage } from "../../lib/supabase";
import { useQuery } from "../../lib/useQuery";
import { catchUpMessages, type MessageCursor } from "./catchUpMessages";
import { mergeMessages } from "./mergeMessages";
import { Empty, Loading, Notice } from "../../components/ui";
import { trackEvent } from "../../lib/events";
import { SafetyControls } from "../safety/SafetyControls";
interface Conversation {
  id: string;
  user_a: string;
  user_b: string;
  context_type: string;
  context_id: string;
}
interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}
export function InboxPage() {
  const { id } = useParams(),
    { session } = useAuth();
  const { data, error, loading, reload } = useQuery(async () => {
    const { data, error } = await getSupabase()
      .from("conversations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data as Conversation[];
  }, session!.user.id);
  useEffect(() => {
    const timer = setInterval(reload, 20000);
    return () => clearInterval(timer);
  }, [reload]);
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">A GOOD PLACE TO SAY HELLO</span>
          <h1>Your conversations.</h1>
          <p>Take the next step, one message at a time.</p>
        </div>
      </div>
      {error && <Notice>{error}</Notice>}
      {loading && !data ? (
        <Loading />
      ) : (
        <div className="inbox-layout">
          <aside className="thread-list">
            <h2>
              <MessageCircle size={17} />
              Inbox
            </h2>
            {!data?.length ? (
              <p className="muted">Your conversations will appear here.</p>
            ) : (
              data.map((c, i) => (
                <Link
                  className={"thread " + (id === c.id ? "selected" : "")}
                  to={"/messages/" + c.id}
                  key={c.id}
                >
                  <span className="avatar small-avatar">
                    {c.context_type === "listing" ? "H" : "R"}
                  </span>
                  <span>
                    <strong>
                      {c.context_type === "listing"
                        ? "Housing inquiry"
                        : "Roommate conversation"}
                    </strong>
                    <small>Conversation {i + 1}</small>
                  </span>
                  <ArrowRight size={15} />
                </Link>
              ))
            )}
          </aside>
          <section className="conversation">
            {id ? (
              <ConversationPanel
                key={id}
                id={id}
                thread={data?.find((c) => c.id === id)}
              />
            ) : (
              <Empty
                title="Small hellos. Big possibilities."
                action={
                  <Link className="button secondary" to="/housing">
                    Explore housing
                    <ArrowRight size={16} />
                  </Link>
                }
              >
                Start from a space or roommate profile to keep your conversation
                connected to your search.
              </Empty>
            )}
          </section>
        </div>
      )}
    </>
  );
}
function ConversationPanel({
  id,
  thread,
}: {
  id: string;
  thread?: Conversation;
}) {
  const { session } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]),
    [content, setContent] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [hasMore, setHasMore] = useState(true);
  const request = useRef<{ id: string; body: string } | null>(null),
    bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true,
      syncing = false;
    let cursor: MessageCursor | null = null;
    const db = getSupabase();
    async function load() {
      if (syncing) return;
      syncing = true;
      try {
        let incoming: Message[];
        if (!cursor) {
          const { data, error } = await db
            .from("messages")
            .select("*")
            .eq("conversation_id", id)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .limit(50);
          if (error) throw error;
          incoming = [...(data as Message[])].reverse();
          if (active) setHasMore(incoming.length === 50);
        } else
          incoming = await catchUpMessages(cursor, async (after) => {
            const { data, error } = await db
              .from("messages")
              .select("*")
              .eq("conversation_id", id)
              .or(
                `created_at.gt.${after.created_at},and(created_at.eq.${after.created_at},id.gt.${after.id})`,
              )
              .order("created_at")
              .order("id")
              .limit(50);
            if (error) throw error;
            return data as Message[];
          });
        if (active) {
          if (incoming.length) cursor = incoming[incoming.length - 1];
          setMessages((previous) => mergeMessages(previous, incoming));
          setError("");
        }
      } catch (e) {
        if (active) setError(errorMessage(e));
      } finally {
        syncing = false;
        if (active) setLoading(false);
      }
    }
    void load();
    const channel = db
      .channel("conversation:" + id)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: "conversation_id=eq." + id,
        },
        (payload) => {
          if (active)
            setMessages((previous) =>
              mergeMessages(previous, [payload.new as Message]),
            );
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void load();
      });
    const reconnect = () => void load();
    window.addEventListener("online", reconnect);
    const interval = setInterval(reconnect, 15000);
    return () => {
      active = false;
      void db.removeChannel(channel);
      window.removeEventListener("online", reconnect);
      clearInterval(interval);
    };
  }, [id]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!content.trim() || busy) return;
    setBusy(true);
    setError("");
    if (request.current?.body !== content.trim())
      request.current = { id: crypto.randomUUID(), body: content.trim() };
    try {
      const { data, error } = await getSupabase().rpc("send_message", {
        conversation: id,
        client_request_id: request.current.id,
        body: request.current.body,
      });
      if (error) throw error;
      setMessages((previous) => mergeMessages(previous, [data as Message]));
      setContent("");
      request.current = null;
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function older() {
    if (!messages.length) return;
    const first = messages[0];
    const { data, error } = await getSupabase()
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .or(
        `created_at.lt.${first.created_at},and(created_at.eq.${first.created_at},id.lt.${first.id})`,
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(50);
    if (error) setError(error.message);
    else {
      setMessages((previous) => mergeMessages(previous, data as Message[]));
      setHasMore((data?.length || 0) === 50);
    }
  }
  const other = thread
    ? thread.user_a === session!.user.id
      ? thread.user_b
      : thread.user_a
    : null;
  return (
    <>
      <div className="conversation-heading">
        <div>
          <h2>
            {thread?.context_type === "listing"
              ? "About the space"
              : "Roommate conversation"}
          </h2>
          <p className="muted small">Private between participants</p>
        </div>
        {other && (
          <div>
            <SafetyControls userId={other} conversationId={id} />
            <button
              className="plain small"
              onClick={async () => {
                if (
                  !window.confirm(
                    "Have you agreed to a housing or roommate connection with this person? This records your self-reported outcome, not a verified lease.",
                  )
                )
                  return;
                try {
                  await trackEvent({
                    event: "connection_confirmed",
                    entity_id: id,
                  });
                  setError(
                    "Connection recorded. Thanks for sharing your outcome.",
                  );
                } catch (e) {
                  setError(errorMessage(e));
                }
              }}
            >
              Record a successful connection
            </button>
          </div>
        )}
      </div>
      {error && <Notice>{error}</Notice>}
      <div className="message-history">
        {loading ? (
          <Loading />
        ) : !thread ? (
          <Notice>This conversation is unavailable to your account.</Notice>
        ) : (
          <>
            {hasMore && messages.length > 0 && (
              <button className="plain" onClick={() => void older()}>
                Load earlier messages
              </button>
            )}
            {!messages.length && (
              <p className="conversation-tip">
                Introduce yourself, share your dates, and ask what you’d like to
                know.
              </p>
            )}
            {messages.map((m) => (
              <div
                className={
                  "message " + (m.sender_id === session!.user.id ? "mine" : "")
                }
                key={m.id}
              >
                <p>{m.content}</p>
                <time>
                  {new Date(m.created_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
              </div>
            ))}
            <div ref={bottom} />
          </>
        )}
      </div>
      <form className="message-compose" onSubmit={send}>
        <textarea
          aria-label="Your message"
          placeholder="Start with a hello…"
          maxLength={2000}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          disabled={!thread}
        />
        <button
          className="button"
          aria-label="Send message"
          disabled={!thread || busy || !content.trim()}
        >
          <Send size={19} />
        </button>
      </form>
      <p className="fineprint conversation-footer">
        Keep deposits and private documents out of chat until you’ve
        independently verified the arrangement.
      </p>
    </>
  );
}
