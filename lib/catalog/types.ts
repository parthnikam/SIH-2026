export const EDUCATION_RANKS = {
  none: 0,
  "5th": 1,
  "8th": 2,
  "10th": 3,
  "12th": 4,
  iti: 4,
  graduate: 5,
} as const;

export type EducationBand = keyof typeof EDUCATION_RANKS;

export type EmploymentType = "wage" | "self" | "either";

export type Course = {
  id: string;
  title: string;
  qpCode: string;
  nsqfLevel: number;
  hours: number;
  sector: string;
  giaDomain: string;
  minEducation: EducationBand;
  states: string[];
  districts: string[];
  scheme: string;
  employmentType: EmploymentType;
  source: string;
  sourceUrl: string;
  summary: string;
};

export type Job = {
  id: string;
  title: string;
  employer: string;
  sector: string;
  district: string;
  state: string;
  wage: string;
  type: "wage" | "gig" | "apprentice";
  minEducation: EducationBand;
  source: string;
  sourceUrl: string;
  summary: string;
};

export type Pathway = {
  id: string;
  title: string;
  kind: "gia" | "nsfdc" | "scheme";
  giaDomain: string;
  employmentType: EmploymentType;
  summary: string;
  nextStep: string;
  source: string;
  sourceUrl: string;
};

export type Centre = {
  id: string;
  name: string;
  district: string;
  state: string;
  sectors: string[];
  address: string;
  source: string;
  sourceUrl: string;
};

export type CatalogQuery = {
  query?: string;
  state?: string;
  district?: string;
  education?: EducationBand | string;
  sector?: string;
  employmentType?: EmploymentType | string;
  limit?: number;
};

export type BeneficiaryProfile = {
  name?: string;
  village?: string;
  district?: string;
  state?: string;
  education?: string;
  familyOccupation?: string;
  currentLivelihood?: string;
  skills?: string;
  constraints?: string;
  preference?: string;
  language?: string;
};

export type Recommendation = {
  kind: "course" | "job" | "pathway" | "centre";
  id: string;
  title: string;
  detail: string;
  sourceUrl?: string;
};

export type Interview = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: "active" | "completed";
  profile: BeneficiaryProfile;
  transcript: { role: "user" | "agent"; text: string }[];
  recommendations: Recommendation[];
};
