import {
  coordinateForRegion,
  type RegionCoordinate,
} from "@/lib/admin/regions";
import type { RegionSummary } from "@/lib/admin/data";
import officialOutline from "@/lib/admin/india-outline.json";

const WIDTH = 520;
const HEIGHT = 600;

function project({ latitude, longitude }: RegionCoordinate) {
  return {
    x: 48 + (longitude - 68) * 13.1,
    y: 36 + (37 - latitude) * 17.5,
  };
}

function pathFromCoordinates(coordinates: [number, number][]) {
  return coordinates
    .map(([longitude, latitude], index) => {
      const point = project({ latitude, longitude });
      return `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    })
    .join(" ") + " Z";
}

// Survey of India, International Boundary Vector Data (Outline of India),
// generalized at 1:16m and published in February 2026.
// https://surveyofindia.gov.in/pages/outline-maps-of-india
const OFFICIAL_OUTLINE = (
  officialOutline.features[0].geometry.coordinates as unknown as [
    number,
    number,
  ][][][]
)
  .flatMap((polygon) => polygon.map((ring) => pathFromCoordinates(ring)))
  .join(" ");

export function IndiaMap({ regions }: { regions: RegionSummary[] }) {
  const markers = regions.flatMap((region, index) => {
    const coordinate = coordinateForRegion(region.district, region.state);
    if (!coordinate) return [];
    const point = project(coordinate);
    const nearbyEarlierMarkers = regions.slice(0, index).filter((otherRegion) => {
      const otherCoordinate = coordinateForRegion(
        otherRegion.district,
        otherRegion.state,
      );
      if (!otherCoordinate) return false;
      const otherPoint = project(otherCoordinate);
      return Math.hypot(point.x - otherPoint.x, point.y - otherPoint.y) < 14;
    }).length;

    if (nearbyEarlierMarkers) {
      const angle = (nearbyEarlierMarkers * Math.PI * 2) / 3;
      point.x += Math.cos(angle) * 15;
      point.y += Math.sin(angle) * 15;
    }

    return [{ ...region, ...point }];
  });

  return (
    <div className="relative h-full min-h-[430px] overflow-hidden rounded-2xl bg-[#fff1eb]">
      <div className="absolute left-5 top-5 z-10">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-[#b46473] uppercase">
          Geographic reach
        </p>
        <p className="mt-1 text-sm font-semibold text-[#6e3040]">India overview</p>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Map of India showing counselling session regions"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <pattern id="admin-map-grid" width="42" height="42" patternUnits="userSpaceOnUse">
            <path d="M42 0H0V42" fill="none" stroke="#efc9ca" strokeWidth="0.7" opacity="0.65" />
          </pattern>
          <filter id="admin-dot-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width={WIDTH} height={HEIGHT} fill="url(#admin-map-grid)" />
        <path
          d={OFFICIAL_OUTLINE}
          fill="#ffd8d1"
          fillRule="evenodd"
          stroke="#d77b88"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        <text
          x="244"
          y="337"
          textAnchor="middle"
          fill="#c97c88"
          fontSize="28"
          fontWeight="700"
          letterSpacing="8"
          opacity="0.5"
        >
          INDIA
        </text>

        {markers.map((marker) => {
          const radius = 7 + Math.min(marker.count, 6) * 1.5;
          return (
            <g key={`${marker.district}-${marker.state}`}>
              <circle
                cx={marker.x}
                cy={marker.y}
                r={radius + 10}
                fill="#d64262"
                opacity="0.14"
              />
              <circle
                cx={marker.x}
                cy={marker.y}
                r={radius}
                fill="#d64262"
                stroke="white"
                strokeWidth="3"
                filter="url(#admin-dot-glow)"
              >
                <title>{`${marker.label}: ${marker.count} session${marker.count === 1 ? "" : "s"}`}</title>
              </circle>
              <text
                x={marker.x}
                y={marker.y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="9"
                fontWeight="700"
              >
                {marker.count}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-[#f3c8cc] bg-[#fffaf7]/90 px-3 py-1.5 text-[11px] font-medium text-[#985464] backdrop-blur">
        <span className="h-2 w-2 rounded-full bg-[#d64262]" />
        Session location
      </div>
      <a
        href="https://surveyofindia.gov.in/pages/outline-maps-of-india"
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-4 right-4 rounded-full bg-[#fffaf7]/90 px-3 py-1.5 text-[10px] font-medium text-[#ad6875]"
      >
        Boundary: Survey of India
      </a>
    </div>
  );
}
