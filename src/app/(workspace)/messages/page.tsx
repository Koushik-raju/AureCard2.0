import { ContentWrap } from "@/components/layout/content-wrap";
import { PageHeader } from "@/components/layout/page-header";
import { MessagesThread } from "@/components/messages/messages-explorer";
import { getCurrentUser } from "@/app/actions/auth";
import {
  getConversation,
  getGroupThreadsFor,
  getMembers,
  getThreadMessages,
} from "@/lib/repository";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string; group?: string }>;
}) {
  const user = await getCurrentUser();
  const me = (user?.email ?? "").toLowerCase();
  const [directory, threads] = await Promise.all([
    getMembers(),
    getGroupThreadsFor(me),
  ]);
  const { to, group } = await searchParams;
  const thread = group
    ? threads.find((t) => t.id === group) ?? null
    : null;
  const peer = !group
    ? (directory.find((d) => d.email.toLowerCase() === (to ?? "").toLowerCase()) ??
      directory.filter((d) => d.email.toLowerCase() !== me)[0] ??
      directory[0] ??
      null)
    : null;
  const initialThread = thread
    ? await getThreadMessages(thread.id)
    : me && peer
      ? await getConversation(me, peer.email)
      : [];

  return (
    <ContentWrap>
      <PageHeader
        eyebrow="Collaboration"
        title="Messages"
        description="Simple 1:1 threads and group conversations with people in your directory."
      />
      <MessagesThread
        me={me}
        directory={directory}
        peerEmail={peer?.email ?? null}
        group={thread}
        initialThread={initialThread}
      />
    </ContentWrap>
  );
}
