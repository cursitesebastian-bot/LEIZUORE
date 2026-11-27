import { Suspense } from "react";
import EventDetail from "@/components/host/EventDetail";
import { Skeleton } from "@/components/host/ui";

export const metadata = { title: "Event — ZOURE" };

async function Content({ params }) {
  const { id } = await params;
  return <EventDetail eventId={id} />;
}

export default function EventPage({ params }) {
  return (
    <Suspense fallback={<Skeleton lines={4} label="Loading event" />}>
      <Content params={params} />
    </Suspense>
  );
}
