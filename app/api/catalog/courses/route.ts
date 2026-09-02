import { catalogSources } from "@/lib/catalog/data";
import { parseQuery, searchCourses } from "@/lib/catalog/search";

export async function GET(request: Request) {
  const query = parseQuery(new URL(request.url));
  return Response.json({
    catalogSource: catalogSources.courses,
    results: searchCourses(query),
  });
}
