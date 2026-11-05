/**
 * Public-site layout.
 *
 * ChatWidget used to be mounted here. It was removed, for two reasons that
 * both matter:
 *
 *  1. It POSTs to /api/chatbot, a route handler. The public site is a static
 *     export with no server, so that endpoint does not exist in the deployed
 *     build — the widget would have opened and then silently failed.
 *  2. The agreed first cut is the public pages plus the enquiry form. The
 *     chatbot is explicitly out of it, and out of the navigation.
 *
 * The portal keeps its own full-page chat at /chatbot, which is part of the
 * private build and unaffected.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
