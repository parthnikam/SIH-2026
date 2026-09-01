import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
      <p className="text-lg">Not found</p>
      <Link href="/" className="text-sm underline">
        Back to the phone
      </Link>
    </div>
  );
}
