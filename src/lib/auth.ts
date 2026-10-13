import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import dbConnect from './mongoose';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// 3-20 chars, letters/digits/underscore, unique. "Chris Luck" -> "ChrisLuck",
// taken -> "ChrisLuck4821".
async function uniqueUsername(raw: string): Promise<string> {
  let base = raw.normalize('NFKD').replace(/[^A-Za-z0-9_]/g, '').slice(0, 14);
  if (base.length < 3) base = `Gen${base}`.slice(0, 14);
  let candidate = base;
  for (let i = 0; i < 12; i++) {
    if (!(await User.exists({ username: candidate }))) return candidate;
    candidate = `${base}${Math.floor(1000 + Math.random() * 9000)}`.slice(0, 20);
  }
  return `${base.slice(0, 8)}${Date.now().toString(36)}`.slice(0, 20);
}
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password required');
        }

        await dbConnect();
        const user = await User.findOne({ email: credentials.email });

        if (!user) {
          throw new Error('No user found with this email');
        }

        // Check if user has a password (not OAuth user)
        if (!user.password) {
          throw new Error('Please sign in with Google');
        }

        // Check if email is verified
        if (!user.emailVerified) {
          throw new Error('Please verify your email first');
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error('Invalid password');
        }

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.username,
          image: user.avatar,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/mobile',
    error: '/mobile',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google') return true;
      const email = user.email?.toLowerCase();
      // Google must vouch for the address, otherwise anyone could claim it
      if (!email || (profile as any)?.email_verified === false) return false;

      try {
        await dbConnect();
        const existing = await User.findOne({ email });

        if (existing) {
          existing.lastLogin = new Date();
          // Google proved ownership of the address, so a password account that
          // never clicked its verification mail is verified now
          if (!existing.emailVerified) existing.emailVerified = true;
          await existing.save();
          return true;
        }

        // The schema requires a password and 3-20 char unique usernames; a Google
        // account has neither, so give it an unusable random password (no one can
        // log in with it via /api/auth/login) and a generated username.
        const username = await uniqueUsername(user.name || email.split('@')[0]);
        const avatarId = Math.floor(Math.random() * 16) + 1;
        await User.create({
          email,
          username,
          password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
          // Same default avatar as email sign-up: no personal Google photo is
          // imposed on a public leaderboard. Changeable in the profile.
          avatar: `https://i.pravatar.cc/150?img=${avatarId}`,
          emailVerified: true,
          points: 5.00, // Starting bonus, same as /api/auth/register
          wins: 0,
          gamesPlayed: 0,
          country: 'World',
          countryFlag: '🌍',
        });
        return true;
      } catch (error) {
        console.error('Error saving Google user:', error);
        // Not continuing: a NextAuth session without a database user would log
        // the player in to nothing
        return false;
      }
    },    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      if (account?.provider === 'google') {
        token.provider = 'google';
      }
      
      // Fetch full user data from DB
      if (token.email) {
        try {
          await dbConnect();
          const dbUser = await User.findOne({ email: token.email });
          if (dbUser) {
            token.id = dbUser._id.toString();
            token.username = dbUser.username;
            token.avatar = dbUser.avatar;
            token.country = dbUser.country;
            token.countryFlag = dbUser.countryFlag;
            token.points = dbUser.points;
            token.isAdmin = dbUser.isAdmin;
          }
        } catch (error) {
          console.error('Error fetching user in JWT callback:', error);
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.avatar = token.avatar as string;
        session.user.country = token.country as string;
        session.user.countryFlag = token.countryFlag as string;
        session.user.points = token.points as number;
        session.user.isAdmin = token.isAdmin as boolean;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
