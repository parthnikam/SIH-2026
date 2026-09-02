# Catalog sources

Seeded from public government pages. No login-walled MIS was scraped.

| Record type | Source | URL |
| --- | --- | --- |
| GIA livelihood domains | PM-AJAY illustrative list (MoSJE) | https://pmajay.dosje.gov.in/illustrative-list |
| Scheme rules | PM-AJAY portal | https://pmajay.dosje.gov.in |
| NSQF qualifications / QP codes | National Qualifications Register (NCVET) | https://www.nqr.gov.in |
| NQR migration | Kaushalverse | https://kaushalverse.ncvet.gov.in/homepage/repository |
| Course / centre discovery model | Skill India Digital Hub | https://www.skillindiadigital.gov.in |
| SC skilling eligibility | PM-DAKSH | https://pmdaksh.dosje.gov.in |
| Live course list | PM-AJAY, Department of Social Justice and Empowerment (MoSJE) | https://pmajay.dosje.gov.in/CourseList |
| Live jobs | National Career Service, Ministry of Labour and Employment | https://www.ncs.gov.in/job-listing |
| Self-employment credit | NSFDC | https://nsfdc.nic.in |
| Informal worker job match | e-Shram (via NCS) | https://eshram.gov.in |

Run `npm run data:refresh` to fetch every available PM-AJAY course and NCS job into `data/generated/`. Complete upstream records are retained in `*.raw.json`; cleaned files power the recommendation search. App startup never contacts either portal. If a refresh fails, the last good snapshot is retained; a clean clone falls back to the seeded proof-of-concept catalog.
