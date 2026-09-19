import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HakoX Admin — Panel Manajemen",
  description:
    "Panel admin HakoX: kelola pengguna, pantau trade & posisi kontrak, atur pengumuman, dan lihat statistik exchange dalam satu tempat.",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
