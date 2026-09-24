import { ContentWrap } from "@/components/layout/content-wrap";
import { PageHeader } from "@/components/layout/page-header";
import { MessagesExplorer } from "@/components/messages/messages-explorer";
import { getCurrentUser } from "@/app/actions/auth";
import {
  getConversation,
  getMembers,
  getMyMessages,
} from "@/lib/repository";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>;
}) {
  const user = await getCurrentUser();
  const me = (user?.email ?? "").toLowerCase();
  const [directory, mine] = await Promise.all([getMembers(), getMyMessages(me)]);
  const peers = directory.filter((d) => d.email.toLowerCase() !== me);
  const { to } = await searchParams;
  const peer =
    directory.find((d) => d.email.toLowerCase() === (to ?? "").toLowerCase()) ??
    peers[0] ??
    directory[0];
  const thread =
    me && peer ? await getConversation(me, peer.email) : [];

  return (
    <ContentWrap>
      <PageHeader
        eyebrow="Collaboration"
        title="Messages"
        description="Simple 1:1 threads with people in your directory."
      />
      <MessagesExplorer
        me={me}
        directory={directory}
        peerEmail={peer?.email ?? null}
        initialThread={thread}
        recent={mine}
      />
    </ContentWrap>
  );
}
