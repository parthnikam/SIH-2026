import { parseQuery, searchPathways } from "@/lib/catalog/search";

export async function GET(request: Request) {
  const query = parseQuery(new URL(request.url));
  return Response.json({ results: searchPathways(query) });
}
