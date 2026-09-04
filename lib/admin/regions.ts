export type RegionCoordinate = {
  latitude: number;
  longitude: number;
};

const STATE_ALIASES: Record<string, string> = {
  assam: "Assam",
  aasam: "Assam",
  "आसाम": "Assam",
  "असम": "Assam",
  "অসম": "Assam",
  rajasthan: "Rajasthan",
  "राजस्थान": "Rajasthan",
  karnataka: "Karnataka",
  "कर्नाटक": "Karnataka",
  bihar: "Bihar",
  "बिहार": "Bihar",
  haryana: "Haryana",
  "हरियाणा": "Haryana",
  "uttar pradesh": "Uttar Pradesh",
  "उत्तर प्रदेश": "Uttar Pradesh",
};

const DISTRICT_ALIASES: Record<string, string> = {
  nalbari: "Nalbari",
  "नलबाड़ी": "Nalbari",
  "নলবাৰী": "Nalbari",
  kamrup: "Kamrup",
  "कामरूप": "Kamrup",
  jaipur: "Jaipur",
  "जयपुर": "Jaipur",
  kota: "Kota",
  "कोटा": "Kota",
  ghaziabad: "Ghaziabad",
  "गाजियाबाद": "Ghaziabad",
};

export const STATE_COORDINATES: Record<string, RegionCoordinate> = {
  "Andaman and Nicobar Islands": { latitude: 11.7, longitude: 92.7 },
  "Andhra Pradesh": { latitude: 15.9, longitude: 79.7 },
  "Arunachal Pradesh": { latitude: 28.2, longitude: 94.7 },
  Assam: { latitude: 26.2, longitude: 92.9 },
  Bihar: { latitude: 25.9, longitude: 85.6 },
  Chandigarh: { latitude: 30.7, longitude: 76.8 },
  Chhattisgarh: { latitude: 21.3, longitude: 82.0 },
  Delhi: { latitude: 28.6, longitude: 77.2 },
  Goa: { latitude: 15.3, longitude: 74.1 },
  Gujarat: { latitude: 22.3, longitude: 71.2 },
  Haryana: { latitude: 29.1, longitude: 76.1 },
  "Himachal Pradesh": { latitude: 31.1, longitude: 77.2 },
  "Jammu and Kashmir": { latitude: 33.8, longitude: 76.5 },
  Jharkhand: { latitude: 23.6, longitude: 85.3 },
  Karnataka: { latitude: 15.3, longitude: 75.7 },
  Kerala: { latitude: 10.2, longitude: 76.3 },
  Ladakh: { latitude: 34.2, longitude: 77.6 },
  "Madhya Pradesh": { latitude: 23.5, longitude: 78.8 },
  Maharashtra: { latitude: 19.8, longitude: 75.7 },
  Manipur: { latitude: 24.7, longitude: 93.9 },
  Meghalaya: { latitude: 25.5, longitude: 91.3 },
  Mizoram: { latitude: 23.2, longitude: 92.9 },
  Nagaland: { latitude: 26.1, longitude: 94.6 },
  Odisha: { latitude: 20.3, longitude: 84.0 },
  Puducherry: { latitude: 11.9, longitude: 79.8 },
  Punjab: { latitude: 31.1, longitude: 75.3 },
  Rajasthan: { latitude: 26.6, longitude: 73.8 },
  Sikkim: { latitude: 27.5, longitude: 88.5 },
  "Tamil Nadu": { latitude: 11.0, longitude: 78.4 },
  Telangana: { latitude: 18.1, longitude: 79.0 },
  Tripura: { latitude: 23.8, longitude: 91.3 },
  "Uttar Pradesh": { latitude: 26.8, longitude: 80.9 },
  Uttarakhand: { latitude: 30.1, longitude: 79.2 },
  "West Bengal": { latitude: 23.8, longitude: 88.2 },
};

const DISTRICT_COORDINATES: Record<string, RegionCoordinate> = {
  Nalbari: { latitude: 26.45, longitude: 91.44 },
  Kamrup: { latitude: 26.12, longitude: 91.59 },
  Jaipur: { latitude: 26.91, longitude: 75.79 },
  Kota: { latitude: 25.18, longitude: 75.83 },
  Ghaziabad: { latitude: 28.67, longitude: 77.45 },
};

function clean(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") || "";
}

export function normalizeState(value: string | null | undefined) {
  const cleaned = clean(value);
  if (!cleaned) return "";
  return STATE_ALIASES[cleaned.toLowerCase()] || cleaned;
}

export function normalizeDistrict(value: string | null | undefined) {
  const cleaned = clean(value);
  if (!cleaned) return "";
  return DISTRICT_ALIASES[cleaned.toLowerCase()] || cleaned;
}

export function coordinateForRegion(district: string, state: string) {
  return DISTRICT_COORDINATES[district] || STATE_COORDINATES[state] || null;
}
