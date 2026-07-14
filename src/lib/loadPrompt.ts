import { readFileSync } from 'fs';
import { join } from 'path';

const PROMPTS_DIR = join(process.cwd(), 'src', 'prompts');

// Cache prompts in memory (they don't change during runtime)
const promptCache: Record<string, string> = {};

/**
 * Load a prompt file from src/prompts/
 * Caches the result for performance.
 * 
 * @param filename - The prompt file name (e.g., 'core.txt', 'trivia.txt')
 * @returns The prompt content as a string
 */
export function loadPrompt(filename: string): string {
  if (promptCache[filename]) {
    return promptCache[filename];
  }
  
  try {
    const content = readFileSync(join(PROMPTS_DIR, filename), 'utf-8');
    promptCache[filename] = content;
    return content;
  } catch (error) {
    console.error(`Failed to load prompt: ${filename}`, error);
    return '';
  }
}

/**
 * Combine multiple prompts into one system prompt.
 * Always include 'core.txt' first for base context.
 * 
 * @param filenames - Array of prompt filenames to combine
 * @returns Combined prompt string
 * 
 * @example
 * // For trivia generation:
 * const systemPrompt = combinePrompts(['core.txt', 'trivia.txt']);
 * 
 * // For article generation:
 * const systemPrompt = combinePrompts(['core.txt', 'article-prompt.txt']);
 */
export function combinePrompts(filenames: string[]): string {
  return filenames.map(loadPrompt).filter(Boolean).join('\n\n');
}

/**
 * Clear the prompt cache (useful for development/testing)
 */
export function clearPromptCache(): void {
  Object.keys(promptCache).forEach(key => delete promptCache[key]);
}
