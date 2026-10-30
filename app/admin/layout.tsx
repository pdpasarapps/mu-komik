import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/login?next=/admin");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, is_staff")
    .eq("id", authData.user.id)
    .maybeSingle();

  let role: string | null = profile?.role ?? null;
  let isStaff = profile?.is_staff === true;
  if (error) {
    const { data: roleOnly } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();
    role = roleOnly?.role ?? null;
    isStaff = false;
  }

  if (role !== "admin" && role !== "staff" && !isStaff) redirect("/account");

  return children;
}
