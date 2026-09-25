import { ContentWrap } from "@/components/layout/content-wrap";
import { PageHeader } from "@/components/layout/page-header";
import {
  MessagesPeople,
  MessagesThread,
} from "@/components/messages/messages-explorer";
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
    <div className="flex">
      <MessagesPeople
        me={me}
        directory={directory}
        peerEmail={peer?.email ?? null}
        recent={mine}
        panel
      />
      <div className="min-w-0 flex-1">
        <ContentWrap>
          <PageHeader
            eyebrow="Collaboration"
            title="Messages"
            description="Simple 1:1 threads with people in your directory."
          />
          <MessagesThread
            me={me}
            directory={directory}
            peerEmail={peer?.email ?? null}
            initialThread={thread}
          />
        </ContentWrap>
      </div>
    </div>
  );
}
