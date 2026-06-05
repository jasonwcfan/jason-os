import { redirect } from "next/navigation";

// CRM follow-ups were merged into the Tasks module. Keep the old URL working.
export default function FollowUpsPage() {
  redirect("/tasks");
}
