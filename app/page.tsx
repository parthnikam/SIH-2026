import Link from "next/link";
import { Phone } from "@/components/phone/Phone";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-10">
      <Phone />
      <Link href="/officer" className="text-sm text-zinc-600 underline">
        Officer desk
      </Link>
    </div>
  );
}
