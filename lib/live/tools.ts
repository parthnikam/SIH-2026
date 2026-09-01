import { Type, type FunctionDeclaration, type Tool } from "@google/genai";

const string = (description: string) => ({
  type: Type.STRING,
  description,
});

export const FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "search_courses",
    description:
      "Search NSQF-aligned skill courses from NQR / SIDH / PM-AJAY / PM-DAKSH / Vishwakarma.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: string("Trade, skill or keywords, e.g. electrician, dairy, tailor"),
        state: string("Indian state name"),
        district: string("District name"),
        education: string("none | 5th | 8th | 10th | 12th | iti | graduate"),
        sector: string("Sector or GIA domain"),
        employmentType: string("wage | self | either"),
      },
      required: ["query"],
    },
  },
  {
    name: "search_jobs",
    description:
      "Search district-level wage jobs shaped like National Career Service listings.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: string("Job or skill keywords"),
        state: string("Indian state name"),
        district: string("District name"),
        education: string("none | 5th | 8th | 10th | 12th | iti | graduate"),
        sector: string("Sector"),
      },
      required: ["query"],
    },
  },
  {
    name: "search_pathways",
    description:
      "Search PM-AJAY GIA livelihood domains and NSFDC credit schemes for self-employment.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: string("Occupation or scheme keywords"),
        employmentType: string("wage | self | either"),
      },
      required: ["query"],
    },
  },
  {
    name: "search_centres",
    description: "Find training or facilitation centres near a district.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: string("Optional sector keywords"),
        state: string("Indian state name"),
        district: string("District name"),
      },
      required: ["district"],
    },
  },
  {
    name: "save_profile",
    description:
      "Save the counselling profile and the 2–3 options you recommended. Call this before ending.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: string("Beneficiary name"),
        village: string("Village or block"),
        district: string("District"),
        state: string("State"),
        education: string("Education band"),
        familyOccupation: string("Traditional or family work"),
        currentLivelihood: string("What they do now"),
        skills: string("Skills and interests"),
        constraints: string("Mobility, health, childcare notes"),
        preference: string("wage | self | either"),
        language: string("Language they spoke"),
        recommendations: {
          type: Type.ARRAY,
          description: "The options you spoke on the call",
          items: {
            type: Type.OBJECT,
            properties: {
              kind: string("course | job | pathway | centre"),
              id: string("Catalog id if known"),
              title: string("Title you told them"),
              detail: string("Why it fits, in their language or simple English"),
              sourceUrl: string("Official URL"),
            },
          },
        },
      },
    },
  },
];

export const LIVE_TOOLS: Tool[] = [
  { functionDeclarations: FUNCTION_DECLARATIONS },
];
