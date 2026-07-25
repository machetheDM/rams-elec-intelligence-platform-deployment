import ChatWidget from "@/components/chat/ChatWidget";

/**
 * Public-site layout.
 *
 * Adds the floating AI assistant to public pages only — the customer
 * portal has its own full-page chat at /chatbot, so mounting the widget
 * in the root layout would double up there.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ChatWidget />
    </>
  );
}
