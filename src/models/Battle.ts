import mongoose, { Schema, Document } from 'mongoose';

export interface IBattle extends Document {
  creator: mongoose.Types.ObjectId;
  opponent?: mongoose.Types.ObjectId;
  topic: string;
  wager: number;
  rounds: number;
  status: 'open' | 'active' | 'completed' | 'cancelled' | 'expired';
  
  // Questions for this battle
  questions: {
    questionId: string; // Card ID with suffix (e.g., "cardId_3")
    cardId?: mongoose.Types.ObjectId; // Source card - needed to record play history and avoid repeats
    question: string;
    answers: string[];
    correctIndex: number;
    points: number;
  }[];
  
  // Creator's results
  creatorResults: {
    round: number;
    correct: boolean;
    timeMs: number;
    points: number;
    answerIndex?: number;
  }[];
  creatorTotalPoints: number;
  
  // Opponent's results
  opponentResults: {
    round: number;
    correct: boolean;
    timeMs: number;
    points: number;
    answerIndex?: number;
  }[];
  opponentTotalPoints: number;
  
  // Winner
  winner?: mongoose.Types.ObjectId;
  
  // Private battle (invite only, not shown in pool)
  isPrivate: boolean;
  
  // Direct challenge to specific user
  challengedUser?: mongoose.Types.ObjectId;
  
  // Set when opponent declines a challenge (to distinguish from self-cancelled)
  declinedBy?: mongoose.Types.ObjectId;
  declinedAt?: Date;
  // Set when the creator manually dismisses the "declined" notice from My Open Battles
  dismissedByCreator?: boolean;
  
  // Timestamps
  createdAt: Date;
  acceptedAt?: Date;
  completedAt?: Date;
}

const BattleSchema = new Schema<IBattle>({
  creator: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  opponent: { 
    type: Schema.Types.ObjectId, 
    ref: 'User' 
  },
  topic: { 
    type: String, 
    required: true,
    enum: ['sport', 'music', 'film', 'culture', 'fashion', 'games', 'tv', 'art', 'food']
  },
  wager: { 
    type: Number, 
    required: true,
    min: 0.01 // BOGX values - no enum restriction
  },
  rounds: { 
    type: Number, 
    required: true,
    enum: [3, 5]
  },
  status: { 
    type: String, 
    default: 'open',
    enum: ['open', 'active', 'completed', 'cancelled', 'expired']
  },
  
  questions: [{
    questionId: { type: String }, // Card ID with suffix (e.g., "cardId_3")
    cardId: { type: Schema.Types.ObjectId, ref: 'Card' },
    question: String,
    answers: [String],
    correctIndex: Number,
    points: { type: Number, default: 300 }
  }],
  
  creatorResults: [{
    round: Number,
    correct: Boolean,
    timeMs: Number,
    points: Number,
    answerIndex: Number
  }],
  creatorTotalPoints: { type: Number, default: 0 },
  
  opponentResults: [{
    round: Number,
    correct: Boolean,
    timeMs: Number,
    points: Number,
    answerIndex: Number
  }],
  opponentTotalPoints: { type: Number, default: 0 },
  
  winner: { type: Schema.Types.ObjectId, ref: 'User' },
  
  isPrivate: { type: Boolean, default: false },
  
  challengedUser: { type: Schema.Types.ObjectId, ref: 'User' },
  
  declinedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  declinedAt: Date,
  dismissedByCreator: { type: Boolean, default: false },
  
  acceptedAt: Date,
  completedAt: Date
}, {
  timestamps: true
});

// Index for finding open battles
BattleSchema.index({ status: 1, topic: 1 });
BattleSchema.index({ creator: 1, status: 1 });
BattleSchema.index({ opponent: 1, status: 1 });
BattleSchema.index({ challengedUser: 1, status: 1 }); // For finding pending challenges

// Force re-register model with new schema
if (mongoose.models.Battle) {
  delete mongoose.models.Battle;
}
export default mongoose.model<IBattle>('Battle', BattleSchema);
