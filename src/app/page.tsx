import { redirect } from "next/navigation";

export default function Home() {
  // The CRM is module #1 and the default landing surface for now.
  redirect("/crm");
}
