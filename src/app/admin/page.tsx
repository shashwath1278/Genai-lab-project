import type { Metadata } from "next";
import AdminApp from "@/components/admin/AdminApp";

export const metadata: Metadata = { title: "Staff dashboard · Northgate Copilot" };

export default function AdminPage() {
  return <AdminApp />;
}
