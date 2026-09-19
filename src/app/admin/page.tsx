"use client";

import { AdminPanel } from "@/components/admin/admin-panel";
import { useRouter } from "next/navigation";

/**
 * Halaman mandiri untuk panel admin.
 * URL khusus: /admin — terpisah dari aplikasi exchange utama di /.
 */
export default function AdminPage() {
  const router = useRouter();
  return <AdminPanel onExit={() => router.push("/")} />;
}
