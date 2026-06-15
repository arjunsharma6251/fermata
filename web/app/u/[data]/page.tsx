import type { Metadata } from "next";
import { ProfileView } from "@/components/ProfileView";

type Props = { params: Promise<{ data: string }> };

export const metadata: Metadata = {
  title: "A craft map",
  description:
    "A discovery map of songs connected by the craft moves they share — built on fermata.",
  openGraph: {
    title: "A craft map · fermata",
    description: "Songs connected by the craft moves they share.",
  },
};

export default async function ProfilePage({ params }: Props) {
  const { data } = await params;
  return <ProfileView data={data} />;
}
