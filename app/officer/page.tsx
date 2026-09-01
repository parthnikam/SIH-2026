import Link from "next/link";
import { listInterviews } from "@/lib/interviews/store";

export const dynamic = "force-dynamic";

export default async function OfficerPage() {
  const rows = await listInterviews();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-medium">Officer desk</h1>
        <Link href="/" className="text-sm underline">
          Helpline phone
        </Link>
      </div>
      <p className="text-sm text-zinc-600">
        Completed and in-progress PM-AJAY GIA counselling calls.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm">No interviews yet. Make a call first.</p>
      ) : (
        <ul className="divide-y divide-zinc-300 border-y border-zinc-300">
          {rows.map((row) => (
            <li key={row.id} className="py-3">
              <Link href={`/interview/${row.id}`} className="block">
                <p className="font-medium">
                  {row.profile.name || "Unnamed caller"}
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  {[row.profile.district, row.profile.state]
                    .filter(Boolean)
                    .join(", ") || "Location not saved"}{" "}
                  · {row.status} ·{" "}
                  {new Date(row.updatedAt).toLocaleString("en-IN")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
