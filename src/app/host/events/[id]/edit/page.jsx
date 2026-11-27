import { Suspense } from "react";
import EventWizard from "@/components/host/EventWizard";
import { Skeleton } from "@/components/host/ui";

export const metadata = { title: "Edit event — ZOURE" };

async function Content({ params }) {
  const { id } = await params;
  return <EventWizard eventId={id} />;
}

export default function EditEventPage({ params }) {
  return (
    <Suspense fallback={<Skeleton lines={4} label="Loading event" />}>
      <Content params={params} />
    </Suspense>
  );
}
