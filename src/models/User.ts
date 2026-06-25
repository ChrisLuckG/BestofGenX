import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  avatar: string;
  country: string;
  countryFlag: string;
  phone?: string;
  points: number; // Legacy - use bogxCoins
  bogxCoins: number; // BOGX currency (0.00 format)
  authorEarnings: number; // Earnings from article reads (for authors)
  hasReceivedWelcomeBonus: boolean;
  wins: number;
  gamesPlayed: number;
  isAdmin: boolean;
  isAuthor?: boolean;
  displayName?: string;
  bio?: string;
  socialLinks?: {
    twitter?: string;
    instagram?: string;
    facebook?: string;
    linkedin?: string;
    website?: string;
  };
  isBot: boolean;
  botActive?: boolean;
  notifyEmail?: boolean;
  notifySms?: boolean;
  notifyBattleResults?: boolean;
  notifyBattleAccepted?: boolean;
  notifyRanking?: boolean;
  pushSubscription?: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
  pushSubscriptionUpdatedAt?: Date;
  lastLogin?: Date;
  lastSeenRank?: number; // User's rank when they last saw the welcome screen
  lastSeenRankAt?: Date; // When lastSeenRank was recorded
  lastNotificationView?: Date;
  dismissedNotifications?: string[]; // IDs of dismissed notifications
  readNotifications?: string[]; // IDs of read (but not dismissed) notifications
  readArticles?: string[]; // IDs of articles user has read (and received points for)
  referralCode?: string; // Unique referral code
  referralCount?: number; // Number of successful referrals
  referredBy?: mongoose.Types.ObjectId; // Who referred this user
  emailVerified?: boolean; // Email verification status
  emailVerificationToken?: string; // Token for email verification
  emailVerificationExpires?: Date; // Token expiry
  passwordResetToken?: string; // Token for password reset
  passwordResetExpires?: Date; // Token expiry
  isDeleted?: boolean; // Soft delete flag
  deletedAt?: Date; // When user was deleted
  lastBattleHeartbeat?: Date; // Last time user sent heartbeat from QuizzBattle page
  battleScreen?: string; // Current screen in QuizzBattle ('setup', 'pool', 'quiz', etc.)
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    avatar: {
      type: String,
      default: '',
    },
    country: {
      type: String,
      default: 'World',
    },
    countryFlag: {
      type: String,
      default: '🌍',
    },
    phone: {
      type: String,
      default: '',
    },
    notifyEmail: {
      type: Boolean,
      default: false,
    },
    notifySms: {
      type: Boolean,
      default: false,
    },
    notifyBattleResults: {
      type: Boolean,
      default: true, // On by default
    },
    notifyBattleAccepted: {
      type: Boolean,
      default: true, // On by default
    },
    notifyRanking: {
      type: Boolean,
      default: true, // On by default
    },
    points: {
      type: Number,
      default: 0, // Legacy - kept for backwards compatibility
    },
    bogxCoins: {
      type: Number,
      default: 0, // BOGX currency (0.00 format)
    },
    authorEarnings: {
      type: Number,
      default: 0, // Earnings from article reads (for authors)
    },
    hasReceivedWelcomeBonus: {
      type: Boolean,
      default: false,
    },
    wins: {
      type: Number,
      default: 0,
    },
    gamesPlayed: {
      type: Number,
      default: 0,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    isAuthor: {
      type: Boolean,
      default: false,
    },
    displayName: {
      type: String,
      default: '',
      maxlength: 60,
    },
    bio: {
      type: String,
      default: '',
      maxlength: 500,
    },
    socialLinks: {
      twitter: { type: String, default: '' },
      instagram: { type: String, default: '' },
      facebook: { type: String, default: '' },
      linkedin: { type: String, default: '' },
      website: { type: String, default: '' },
    },
    isBot: {
      type: Boolean,
      default: false,
    },
    botActive: {
      type: Boolean,
      default: true, // Bots are active by default
    },
    pushSubscription: {
      type: Object,
      default: null,
    },
    pushSubscriptionUpdatedAt: {
      type: Date,
      default: null,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    lastSeenRank: {
      type: Number,
      default: null,
    },
    lastSeenRankAt: {
      type: Date,
      default: null,
    },
    lastNotificationView: {
      type: Date,
      default: null,
    },
    dismissedNotifications: {
      type: [String],
      default: [],
    },
    readNotifications: {
      type: [String],
      default: [],
    },
    readArticles: {
      type: [String],
      default: [],
    },
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    referralCount: {
      type: Number,
      default: 0,
    },
    referredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      default: null,
    },
    emailVerificationExpires: {
      type: Date,
      default: null,
    },
    passwordResetToken: {
      type: String,
      default: null,
    },
    passwordResetExpires: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    // Battle presence tracking
    lastBattleHeartbeat: {
      type: Date,
      default: null,
    },
    battleScreen: {
      type: String,
      default: null, // 'setup', 'pool', 'quiz', 'result', etc.
    },
  },
  {
    timestamps: true,
  }
);

// Index for rankings
UserSchema.index({ points: -1 });
// Index for online battle players
UserSchema.index({ lastBattleHeartbeat: -1 });

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
