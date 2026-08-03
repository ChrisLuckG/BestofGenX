// Types for NewsroomConference

export interface Reporter {
  _id: string;
  username: string;
  displayName?: string;
  avatar?: string;
}

export interface ReporterProfile {
  _id: string;
  userId: string;
  role: string;
  region?: string;
  nationality: string;
  specialty?: string;
  responsibilities?: string;
  writingStyle?: string;
  personality?: string;
  user?: Reporter;
}

export interface Proposal {
  name: string;
  birthday: string;
  deathday?: string;
  causeOfDeath?: string;
  country: string;
  profession: string;
  description: string;
  reporterId: string;
  reporterName: string;
  reporterSpecialty?: string;
  category?: string;
  isRIP?: boolean;
  isEvent?: boolean;
  isError?: boolean;
}

export interface ConferenceMessage {
  id: string;
  from: 'me' | 'system' | 'result' | 'article-preview' | 'menschen-check' | 'proposals' | string;
  name?: string;
  text: string;
  avatar?: string;
  resultType?: 'article' | 'rankroll' | 'tv' | 'menschen';
  articleDraftId?: string;
  activated?: boolean;
  proposals?: Proposal[];
}

export interface Piece {
  id: string;
  type: 'article' | 'rankroll' | 'tv' | 'radio';
  date: string;
  messages: ConferenceMessage[];
  completed?: boolean;
}

export interface RosterPerson {
  id: string;
  name: string;
  avatar?: string;
  region: string;
  regionLabel: string;
  role: string;
  specialty: string;
  active: boolean;
}

export interface ArticleDraft {
  _id?: string;
  title: string;
  subtitle: string;
  content: string;
  category: string;
  tags: string[];
  coverImage: string;
  imagePosX?: number;
  imagePosY?: number;
  reporterId?: string;
  reporterName?: string;
  personName?: string;
  personBirthday?: string;
  personDeathday?: string;
  personCauseOfDeath?: string;
  personCountry?: string;
  isRIP?: boolean;
}

export interface EditingReporter {
  id: string;
  name: string;
  nationality: string;
  region: string;
  specialty: string;
  writingStyle: string;
  personality: string;
  responsibilities: string;
}
