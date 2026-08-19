import mongoose from 'mongoose';

/**
 * Question Model - Eine Frage = Ein Dokument
 * Einfache, flache Struktur ohne verschachtelte Arrays
 */
export interface IQuestion {
  _id?: string;
  questionNumber?: number;     // Laufende Nummer (#001, #002, etc.)
  
  // Frage-Inhalt
  question: string;
  options: string[];           // Immer 4 Optionen
  correctAnswer: string;       // Muss in options enthalten sein
  
  // Kategorisierung
  theme: 'MUSIC' | 'SPORTS' | 'TV & MOVIES' | 'GAMING' | 'POLITIK';
  subCategory?: string;        // z.B. "Basketball", "Rock", "Action"
  topic?: string;              // z.B. "Michael Jordan", "Nirvana"
  
  // Schwierigkeit
  difficulty: 'Easy' | 'Medium' | 'Hard';
  
  // Belohnung
  maxReward: number;           // BOGX Belohnung
  
  // Statistiken
  timesPlayed: number;
  timesCorrect: number;
  
  // Meta
  active: boolean;
  questionHash?: string;       // Für Duplikat-Erkennung
  image?: string;              // Optionales Bild
  source: 'admin' | 'generated' | 'battle';
  
  createdAt?: Date;
  updatedAt?: Date;
}

const QuestionSchema = new mongoose.Schema({
  // Laufende Nummer
  questionNumber: {
    type: Number,
    unique: true,
    sparse: true,  // Erlaubt null für alte Einträge
  },
  
  // Frage-Inhalt
  question: { 
    type: String, 
    required: true,
    index: true,
  },
  options: { 
    type: [String], 
    required: true,
    validate: {
      validator: (v: string[]) => v && v.length === 4,
      message: 'Exactly 4 options required'
    }
  },
  correctAnswer: { 
    type: String, 
    required: true,
  },
  
  // Kategorisierung
  theme: { 
    type: String, 
    required: true,
    enum: ['MUSIC', 'SPORTS', 'TV & MOVIES', 'GAMING', 'POLITIK'],
    index: true,
  },
  subCategory: { 
    type: String, 
    default: '',
  },
  topic: { 
    type: String, 
    default: '',
  },
  
  // Schwierigkeit
  difficulty: { 
    type: String, 
    enum: ['Easy', 'Medium', 'Hard'],
    default: 'Medium',
    index: true,
  },
  
  // Belohnung
  maxReward: { 
    type: Number, 
    default: 0.10,
  },
  
  // Statistiken
  timesPlayed: { 
    type: Number, 
    default: 0,
  },
  timesCorrect: { 
    type: Number, 
    default: 0,
  },
  
  // Meta
  active: { 
    type: Boolean, 
    default: true,
    index: true,
  },
  questionHash: { 
    type: String, 
    index: true,
  },
  image: { 
    type: String, 
    default: '',
  },
  source: { 
    type: String, 
    enum: ['admin', 'generated', 'battle'],
    default: 'generated',
  },
}, {
  timestamps: true,
});

// Compound indexes für häufige Queries
QuestionSchema.index({ theme: 1, active: 1 });
QuestionSchema.index({ theme: 1, difficulty: 1, active: 1 });
QuestionSchema.index({ active: 1, createdAt: -1 });
QuestionSchema.index({ questionNumber: 1 });

// Auto-increment questionNumber before save
QuestionSchema.pre('save', async function() {
  if (this.isNew && !this.questionNumber) {
    const QuestionModel = mongoose.model('Question');
    const lastQuestion = await QuestionModel.findOne(
      { questionNumber: { $exists: true } }, 
      { questionNumber: 1 }
    )
      .sort({ questionNumber: -1 })
      .lean() as { questionNumber?: number } | null;
    this.questionNumber = ((lastQuestion?.questionNumber) || 0) + 1;
  }
});

// Delete cached model to force reload
if (mongoose.models.Question) {
  delete mongoose.models.Question;
}

export default mongoose.model<IQuestion>('Question', QuestionSchema);
