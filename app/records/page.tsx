import Link from "next/link";
import { listInterviews } from "@/lib/interviews/store";

export const dynamic = "force-dynamic";

export default async function RecordsPage() {
  const rows = await listInterviews();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-medium">Your records</h1>
        <Link href="/" className="text-sm underline">
          New call
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-600">
          No counselling calls yet. Start one from the helpline.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-300 border-y border-zinc-300">
          {rows.map((row) => {
            const title =
              row.profile.name ||
              [row.profile.district, row.profile.state].filter(Boolean).join(", ") ||
              "Counselling call";
            const place = [row.profile.village || row.profile.block, row.profile.district, row.profile.state]
              .filter(Boolean)
              .join(", ");
            return (
              <li key={row.id}>
                <Link href={`/interview/${row.id}`} className="block py-3">
                  <p className="font-medium">{title}</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {place || "Location not saved"} · {row.status} ·{" "}
                    {new Date(row.updatedAt).toLocaleString("en-IN")}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
