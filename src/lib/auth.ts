import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import dbConnect from './mongoose';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

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
    async signIn({ user, account }) {
      // Save Google users to database
      if (account?.provider === 'google' && user.email) {
        try {
          await dbConnect();
          const existingUser = await User.findOne({ email: user.email });
          
          if (!existingUser) {
            // Generate random avatar
            const avatarId = Math.floor(Math.random() * 16) + 1;
            const defaultAvatar = `https://i.pravatar.cc/150?img=${avatarId}`;
            
            // Create new user from Google
            await User.create({
              email: user.email,
              username: user.name || user.email.split('@')[0],
              avatar: user.image || defaultAvatar,
              provider: 'google',
              emailVerified: true, // Google users are already verified
              points: 500, // Starting bonus
              wins: 0,
              gamesPlayed: 0,
              country: 'World',
              countryFlag: '🌍',
            });
          } else {
            // Update last login
            existingUser.lastLogin = new Date();
            await existingUser.save();
          }
        } catch (error) {
          console.error('Error saving Google user:', error);
          // Continue with sign-in even if DB save fails
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
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
