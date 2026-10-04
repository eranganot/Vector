import { api } from "@/application/facade";
import { Header } from "../_components/header";
import { requireActor } from "../_lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { actor, me, via } = await requireActor();
  const approvals = (await api.myApprovals(actor)).length;
  const roles = actor.kind === "user" ? [...new Set(actor.assignments.map((a) => a.role))] : [];
  return (
    <div className="min-h-screen">
      <Header me={{ name: me.name, title: me.title }} approvals={approvals} roles={roles} via={via} />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-7 sm:px-8">{children}</main>
    </div>
  );
}
