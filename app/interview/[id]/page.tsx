import Link from "next/link";
import { notFound } from "next/navigation";
import { getInterview } from "@/lib/interviews/store";
import { getUserProfile, profileCompletion } from "@/lib/profiles/store";

export const dynamic = "force-dynamic";

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getInterview(id);
  if (!row) notFound();

  const persistedProfile = await getUserProfile(id);
  const p = persistedProfile?.profile ?? row.profile;
  const completion = persistedProfile?.completion ?? profileCompletion(p);
  const fields: [string, string | undefined][] = [
    ["Name", p.name],
    ["Village", p.village],
    ["Block", p.block],
    ["District", p.district],
    ["State", p.state],
    ["Education", p.education],
    ["Family occupation", p.familyOccupation],
    ["Current livelihood", p.currentLivelihood],
    ["Skills", p.skills],
    ["Prior training", p.priorTraining],
    ["Constraints", p.constraints],
    ["Preference", p.preference],
    ["Language", p.language],
  ];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-medium">Counselling record</h1>
        <div className="flex gap-4 text-sm">
          <Link href="/records" className="underline">
            All records
          </Link>
          <Link href="/" className="underline">
            New call
          </Link>
        </div>
      </div>
      <p className="text-sm text-zinc-600">
        {row.status} · {new Date(row.updatedAt).toLocaleString("en-IN")}
        {" · "}
        {completion.complete
          ? "profile complete"
          : `profile ${completion.completionPercent}% complete`}
      </p>

      <section>
        <h2 className="text-sm uppercase tracking-wide text-zinc-500">Profile</h2>
        <dl className="mt-3 divide-y divide-zinc-300 border-y border-zinc-300">
          {fields.map(([label, value]) => (
            <div key={label} className="grid grid-cols-3 gap-4 py-2 text-sm">
              <dt className="text-zinc-500">{label}</dt>
              <dd className="col-span-2">{value || "—"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wide text-zinc-500">
          Recommendations
        </h2>
        {row.recommendations.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">None saved on this call.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-300 border-y border-zinc-300">
            {row.recommendations.map((rec, i) => (
              <li key={`${rec.id}-${i}`} className="py-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  {rec.kind}
                </p>
                <p className="mt-1 font-medium">{rec.title}</p>
                <p className="mt-1 text-sm leading-6">{rec.detail}</p>
                {rec.sourceUrl ? (
                  <a
                    href={rec.sourceUrl}
                    className="mt-1 inline-block text-sm underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Source
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wide text-zinc-500">Transcript</h2>
        {row.transcript.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">No captions captured.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {row.transcript.map((line, i) => (
              <li key={i} className="text-sm leading-6">
                <span className="text-zinc-500">
                  {line.role === "user" ? "You" : "Helpline"}:{" "}
                </span>
                {line.text}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
