import { redirect } from "next/navigation";

export default function UnknownEventsPage() {
  redirect("/events");
}
