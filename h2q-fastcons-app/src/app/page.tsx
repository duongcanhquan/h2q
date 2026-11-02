import { redirect } from "next/navigation";

/** Home → Dashboard (Bước 3) */
export default function HomePage() {
  redirect("/dashboard");
}
