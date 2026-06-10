// Content Filter for Comments
// Filters inappropriate language and flags content for review

const BLOCKED_WORDS = [
  // German
  'fotze', 'fotzen', 'titte', 'titten', 'muschi', 'arschloch', 'arschlöcher',
  'hurensohn', 'hure', 'nutte', 'schlampe', 'wichser', 'schwuchtel', 'spast',
  'behindert', 'mongo', 'missgeburt', 'bastard', 'drecksau', 'fick', 'ficken',
  'gefickt', 'scheisse', 'scheiße', 'kacke', 'pisser', 'schwanz', 'penis',
  'vagina', 'nazi', 'hitler', 'neger', 'nigger', 'kanake', 'kümmeltürke',
  
  // English
  'fuck', 'fucking', 'fucked', 'shit', 'bitch', 'cunt', 'dick', 'cock',
  'pussy', 'asshole', 'bastard', 'whore', 'slut', 'retard', 'faggot',
  'nigga', 'nigger', 'kike', 'chink', 'spic',
];

const WARNING_WORDS = [
  // Words that should be flagged for review but not blocked
  'idiot', 'dumm', 'dummkopf', 'blöd', 'blödmann', 'depp', 'trottel',
  'vollidiot', 'schwachkopf', 'hirni', 'stupid', 'dumb', 'moron', 'jerk',
  'loser', 'hass', 'hate', 'töten', 'kill', 'sterben', 'die', 'umbringen',
];

export interface FilterResult {
  allowed: boolean;
  flagged: boolean;
  flagReason?: string;
  cleanedContent?: string;
  blockedWords: string[];
  warningWords: string[];
}

export function filterContent(content: string): FilterResult {
  const lowerContent = content.toLowerCase();
  const words = lowerContent.split(/\s+/);
  
  const blockedFound: string[] = [];
  const warningFound: string[] = [];
  
  // Check for blocked words
  for (const word of BLOCKED_WORDS) {
    if (lowerContent.includes(word)) {
      blockedFound.push(word);
    }
  }
  
  // Check for warning words
  for (const word of WARNING_WORDS) {
    if (lowerContent.includes(word)) {
      warningFound.push(word);
    }
  }
  
  // If blocked words found, don't allow
  if (blockedFound.length > 0) {
    return {
      allowed: false,
      flagged: true,
      flagReason: `Blocked words: ${blockedFound.join(', ')}`,
      blockedWords: blockedFound,
      warningWords: warningFound,
    };
  }
  
  // If warning words found, allow but flag for review
  if (warningFound.length > 0) {
    return {
      allowed: true,
      flagged: true,
      flagReason: `Review needed: ${warningFound.join(', ')}`,
      cleanedContent: content,
      blockedWords: blockedFound,
      warningWords: warningFound,
    };
  }
  
  // All good
  return {
    allowed: true,
    flagged: false,
    cleanedContent: content,
    blockedWords: [],
    warningWords: [],
  };
}

// Check if user is spamming (same content multiple times)
export function isSpam(content: string, recentComments: string[]): boolean {
  const normalizedContent = content.toLowerCase().trim();
  const duplicates = recentComments.filter(
    c => c.toLowerCase().trim() === normalizedContent
  );
  return duplicates.length >= 2;
}

// Check for suspicious patterns
export function hasSuspiciousPatterns(content: string): { suspicious: boolean; reason?: string } {
  // All caps (shouting)
  if (content.length > 10 && content === content.toUpperCase()) {
    return { suspicious: true, reason: 'All caps (shouting)' };
  }
  
  // Too many exclamation marks
  const exclamationCount = (content.match(/!/g) || []).length;
  if (exclamationCount > 5) {
    return { suspicious: true, reason: 'Excessive exclamation marks' };
  }
  
  // URLs (potential spam)
  if (/https?:\/\/|www\./i.test(content)) {
    return { suspicious: true, reason: 'Contains URL' };
  }
  
  // Repeated characters (e.g., "hahahahahaha" or "!!!!!!")
  if (/(.)\1{5,}/.test(content)) {
    return { suspicious: true, reason: 'Repeated characters' };
  }
  
  return { suspicious: false };
}
