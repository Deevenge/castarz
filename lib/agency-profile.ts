export interface AgencyCredit {
  production: string;
  year: string;
  supplied: string;
  talentCount: string;
  note: string;
}

export interface AgencyProfile {
  name: string;
  username: string;
  description: string;
  photo: string;
  banner: string;
  specialties: string;
  markets: string;
  portfolio: AgencyCredit[];
}

export const emptyAgencyProfile: AgencyProfile = {
  name: "",
  username: "",
  description: "",
  photo: "",
  banner: "",
  specialties: "",
  markets: "",
  portfolio: [],
};

export function normalizeAgencyProfile(data: Partial<AgencyProfile> | undefined): AgencyProfile {
  const portfolio = Array.isArray(data?.portfolio)
    ? data.portfolio.map((credit) => ({
      production: typeof credit?.production === "string" ? credit.production : "",
      year: typeof credit?.year === "string" ? credit.year : "",
      supplied: typeof credit?.supplied === "string" ? credit.supplied : "",
      talentCount: typeof credit?.talentCount === "string" ? credit.talentCount : "",
      note: typeof credit?.note === "string" ? credit.note : "",
    })).filter((credit) => credit.production.trim() || credit.supplied.trim() || credit.note.trim()).slice(0, 12)
    : [];

  return {
    ...emptyAgencyProfile,
    ...data,
    portfolio,
    name: typeof data?.name === "string" ? data.name : "",
    username: typeof data?.username === "string" ? data.username : "",
    description: typeof data?.description === "string" ? data.description : "",
    photo: typeof data?.photo === "string" ? data.photo : "",
    banner: typeof data?.banner === "string" ? data.banner : "",
    specialties: typeof data?.specialties === "string" ? data.specialties : "",
    markets: typeof data?.markets === "string" ? data.markets : "",
  };
}
