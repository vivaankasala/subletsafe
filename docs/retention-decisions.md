# Retention decisions — release blockers

No real students should be onboarded until the founders choose retention periods, lawful/operational justification and responsible operators for the following:

- Account/profile information after a deletion request.
- Listings, photo objects and abandoned upload reservations.
- Private messages and participants' expectations after deletion or blocking.
- Reports and moderation audit evidence, including access restrictions and appeals.
- Operational logs, analytics, backups and expired rate-limit counters.

Current behavior: `request_deletion()` records the request and marks the profile deleted, hiding discovery and disabling new publication/contact. It does not permanently delete Auth users, messages, reports or photo objects. This is an interim safety boundary rather than a finished retention policy. The app describes it as a request handled by the operator.

Permanent deletion needs a reviewed admin workflow and integration tests. Do not enable blanket cascading deletion against live data; reports and conversation history need explicit handling. Provide a clear contact route and expected processing time before launch.
