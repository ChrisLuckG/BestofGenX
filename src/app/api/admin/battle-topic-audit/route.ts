import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';
import Card from '@/models/Card';
import { TOPIC_TO_THEME } from '@/lib/battleTopics';

/**
 * Diagnostic for the "battle labelled FILM but asks SPORTS questions" bug.
 *
 * A battle stores its questions INLINE at creation time, so fixing the creation
 * code does not repair battles that already exist. This endpoint resolves each
 * question back to its source Card and compares that card's theme against the
 * theme the battle's topic maps to.
 *
 * Two different root causes produce a mismatch, and they need different fixes:
 *   - wrongThemeCards  -> the battle pulled cards from another theme (stale battle
 *                         created before the topic filter existed). Delete the battle.
 *   - unresolvedCards  -> question cardIds no longer resolve (card deleted), so the
 *                         battle cannot be verified either way.
 * If NO battle mismatches but questions still feel off-topic in game, then the Card
 * documents themselves are mis-tagged (theme=SPORTS holding a gaming question) and
 * the Card collection needs recategorising instead.
 *
 * GET is read-only. Pass ?delete=true&secret=... to remove mismatching OPEN battles.
 */
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status') || 'open';
    // The clean list is omitted by default to keep the payload small.
    const includeClean = searchParams.get('includeClean') === 'true';
    const shouldDelete = searchParams.get('delete') === 'true';
    const secret = searchParams.get('secret');

    if (shouldDelete && secret !== process.env.CRON_SECRET && secret !== 'cleanup2024') {
      return NextResponse.json({ error: 'Unauthorized - deletion requires secret' }, { status: 401 });
    }

    const battles = await Battle.find({ status: statusParam } as any)
      .select('_id topic wager rounds questions creator opponent creatorResults opponentResults createdAt')
      .populate('creator', 'username isBot')
      .populate('opponent', 'username isBot')
      .lean();

    // Collect every cardId referenced by any battle question. Different creation
    // paths stored the id under different keys, and one path used the composite
    // form `<cardId>_<difficulty>`, so normalise all of them.
    const extractCardId = (q: any): string | null => {
      const raw = q?.cardId ?? q?.questionId;
      if (!raw) return null;
      const asString = raw.toString();
      // Composite form "<cardId>_<difficulty>"
      const base = asString.includes('_') ? asString.split('_')[0] : asString;
      return /^[0-9a-fA-F]{24}$/.test(base) ? base : null;
    };

    const allCardIds = new Set<string>();
    for (const battle of battles) {
      for (const q of (battle.questions as any[]) || []) {
        const id = extractCardId(q);
        if (id) allCardIds.add(id);
      }
    }

    const cards = await Card.find({ _id: { $in: Array.from(allCardIds) } })
      .select('_id theme')
      .lean();
    const cardTheme = new Map(cards.map((c: any) => [c._id.toString(), c.theme]));

    const mismatched: any[] = [];
    const clean: any[] = [];

    for (const battle of battles) {
      const expectedTheme = TOPIC_TO_THEME[battle.topic] ?? null;
      const questions = (battle.questions as any[]) || [];

      const wrongThemeCards: { question: string; cardTheme: string }[] = [];
      let unresolvedCards = 0;

      for (const q of questions) {
        const id = extractCardId(q);
        const theme = id ? cardTheme.get(id) : undefined;
        if (!theme) {
          unresolvedCards++;
          continue;
        }
        if (expectedTheme && theme !== expectedTheme) {
          wrongThemeCards.push({
            question: (q.question || '').slice(0, 70),
            cardTheme: theme,
          });
        }
      }

      const opponent = battle.opponent as any;
      const entry = {
        battleId: battle._id.toString(),
        topic: battle.topic,
        expectedTheme,
        creator: (battle.creator as any)?.username,
        creatorIsBot: (battle.creator as any)?.isBot === true,
        opponent: opponent?.username ?? null,
        opponentIsBot: opponent?.isBot === true,
        // Which side still has to play. An active battle where a HUMAN hasn't played
        // yet is the only case that still serves wrong questions to a real player.
        creatorPlayed: ((battle.creatorResults as any[]) || []).length > 0,
        opponentPlayed: ((battle.opponentResults as any[]) || []).length > 0,
        wager: battle.wager,
        createdAt: battle.createdAt,
        totalQuestions: questions.length,
        wrongThemeCount: wrongThemeCards.length,
        unresolvedCards,
        wrongThemeCards,
      };

      if (wrongThemeCards.length > 0) mismatched.push(entry);
      else clean.push(entry);
    }

    let deleted = 0;
    if (shouldDelete && mismatched.length > 0) {
      // Only OPEN battles are safe to delete outright: nobody has staked a wager
      // against them yet except the creator. Bots need no refund; a real creator
      // would - so refuse and report instead of silently swallowing their coins.
      const realUserBattles = mismatched.filter(m => !m.creatorIsBot);
      if (status !== 'open') {
        return NextResponse.json({
          success: false,
          error: `Refusing to delete non-open battles (status=${status}) - would affect in-progress games.`,
          mismatchedCount: mismatched.length,
        }, { status: 400 });
      }
      if (realUserBattles.length > 0) {
        return NextResponse.json({
          success: false,
          error: 'Refusing to delete: some mismatching battles were created by real users and would need a wager refund. Handle these manually.',
          realUserBattles,
          botBattleCount: mismatched.length - realUserBattles.length,
        }, { status: 400 });
      }
      const ids = mismatched.map(m => m.battleId);
      const res = await Battle.deleteMany({ _id: { $in: ids }, status: 'open' });
      deleted = res.deletedCount || 0;
    }

    return NextResponse.json({
      success: true,
      status,
      totalBattles: battles.length,
      mismatchedCount: mismatched.length,
      cleanCount: clean.length,
      deleted,
      mismatched,
      ...(includeClean ? { clean } : {}),
      hint: mismatched.length === 0
        ? 'No battle serves questions from a foreign theme. If questions still look off-topic in game, the Card documents themselves are mis-tagged - audit the Card collection instead.'
        : 'These battles were created before the topic filter existed. Add ?delete=true&secret=cleanup2024 to remove the bot-created ones.',
    });
  } catch (error: any) {
    console.error('Battle topic audit error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
