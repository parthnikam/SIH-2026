import { parseQuery, searchJobs } from "@/lib/catalog/search";

export async function GET(request: Request) {
  const query = parseQuery(new URL(request.url));
  return Response.json({ results: searchJobs(query) });
}
