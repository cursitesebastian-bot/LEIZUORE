import { Suspense } from "react";
import CheckIn from "@/components/host/CheckIn";
import { Skeleton } from "@/components/host/ui";

export const metadata = { title: "Check-in — ZOURE" };

async function Content({ params }) {
  const { id } = await params;
  return <CheckIn eventId={id} />;
}

export default function CheckInPage({ params }) {
  return (
    <Suspense fallback={<Skeleton lines={4} label="Loading check-in" />}>
      <Content params={params} />
    </Suspense>
  );
}
