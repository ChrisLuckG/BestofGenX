import 'next-auth';
import { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      username: string;
      avatar: string;
      country: string;
      countryFlag: string;
      points: number;
      isAdmin: boolean;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    username?: string;
    avatar?: string;
    country?: string;
    countryFlag?: string;
    points?: number;
    isAdmin?: boolean;
    provider?: string;
  }
}
