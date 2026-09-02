import { Type, type FunctionDeclaration, type Tool } from "@google/genai";

const string = (description: string) => ({
  type: Type.STRING,
  description,
});

export const FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "search_courses",
    description:
      "Search the saved PM-AJAY government course snapshot using skills, education and location.",
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
      "Search the saved National Career Service job snapshot using skills, education and location.",
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
    name: "update_profile",
    description:
      "Silently merge newly learned or corrected beneficiary facts into the persistent profile. Call after every caller answer; send only facts learned in that turn. The response reports whether the profile is complete and which fields are still missing.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: string("Beneficiary name"),
        village: string("Village name"),
        block: string("Block name, when the caller gives a block instead of a village"),
        district: string("District"),
        state: string("State"),
        education: string(
          "Normalised education band: none | 5th | 8th | 10th | 12th | iti | graduate",
        ),
        familyOccupation: string(
          "Traditional or family work; save none or not disclosed when explicitly stated",
        ),
        currentLivelihood: string(
          "What they currently do for income; save unemployed when explicitly stated",
        ),
        skills: string(
          "Skills and interests; save none when the caller explicitly has none",
        ),
        priorTraining: string(
          "Any prior course or training, including PM-DAKSH; save none when explicitly stated",
        ),
        constraints: string(
          "Travel, health, or childcare limits; save none when explicitly stated",
        ),
        preference: string("wage | self | either"),
        language: string("Language they spoke"),
      },
    },
  },
  {
    name: "save_recommendations",
    description:
      "Save the 2–3 options already discussed with the beneficiary. Call only after the profile is complete and catalog searches have finished.",
    parameters: {
      type: Type.OBJECT,
      properties: {
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
            required: ["kind", "id", "title", "detail"],
          },
        },
      },
      required: ["recommendations"],
    },
  },
];

export const LIVE_TOOLS: Tool[] = [
  { functionDeclarations: FUNCTION_DECLARATIONS },
];
