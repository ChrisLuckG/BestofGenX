// Cover-image prompts for the Daily Champions article.
//
// WHY THIS IS SHARED: the cron job and scripts/regenerate-champion-image.ts each
// carried their own copy of the theme list, and they had drifted apart - the script
// still held an older arcade/synthwave set. Regenerating a cover therefore produced
// a visibly different image than the one the cron would have created.
//
// STYLE: deliberately the same treatment as the history banner
// (src/app/api/editorial/history-compile/route.ts): photorealistic, tangible props,
// film grain, dramatic light. The previous "minimalist 3D render" wording produced
// smooth plastic-toy podiums that looked nothing like the rest of the magazine.
//
// NO LETTERING: the earlier prompt asked for `"1st 2nd 3rd" numbers` and then added
// `no text` in the same breath. Image models resolve that contradiction by painting
// mangled pseudo-digits, which is where the crumbling "2 1 3" came from. Rank is now
// conveyed by objects and podium height instead, and the date/title are drawn by the
// UI on top of the image anyway.

export const CHAMPION_THEMES = [
  // Sunday - Champion Podium
  `A photorealistic still life of a three-step winner's podium built from polished walnut and aged brass, the tallest step draped in deep purple #7C3AED velvet. A gold medal on a purple ribbon rests on the top step, a laurel wreath leans against the base. Cream #F5F0E8 marble floor and wall, warm shafts of light, floating dust motes.`,
  // Monday - Quiz Show Stage
  `A photorealistic 1980s television quiz studio, seen wide and empty before the show. Heavy purple #7C3AED velvet stage curtain, cream #F5F0E8 painted set walls, three contestant lecterns with chunky illuminated buzzer buttons and coiled cables. A vintage CRT monitor glows faintly. Warm tungsten stage lighting, visible haze in the beams.`,
  // Tuesday - Leaderboard Glory
  `A photorealistic vintage split-flap ranking board in a brass frame, the kind found in old railway stations, mounted on a cream #F5F0E8 plaster wall. Purple #7C3AED felt behind the flaps, a small brass crown sitting on the frame's top edge. Worn metal, fingerprints, patina. Warm side light casting long soft shadows.`,
  // Wednesday - Brain Power
  `A photorealistic antique anatomical brain model in painted plaster on a brass stand, arranged on a cream #F5F0E8 desk beside a glowing Edison lightbulb, a stack of worn trivia cards, a vinyl record and a film reel. Purple #7C3AED light spilling in from one side. Shallow depth of field, dust and scratches, museum vitrine mood.`,
  // Thursday - Trophy Collection
  `A photorealistic shelf of championship trophies in tarnished silver and gold, walnut plinths, engraved plates left blank, winner ribbons and star badges hanging beside them. Cream #F5F0E8 marble wall, purple #7C3AED velvet curtain drawn to one side. Dramatic raking light, deep shadows, fine dust on the metal.`,
  // Friday - Battle Arena
  `A photorealistic close view of two vintage brass quiz buzzers facing each other across a cream #F5F0E8 marble table, cables trailing off both sides, a worn scoring pad and pencil between them. Purple #7C3AED spotlights from above rim-lighting the metal. Tense duel atmosphere, reflections in the polished tabletop.`,
  // Saturday - Victory Celebration
  `A photorealistic moment of celebration frozen mid-air: real gold foil confetti and purple #7C3AED paper streamers falling, a laurel crown and a champagne coupe on a cream #F5F0E8 marble surface below, one trophy catching the light. Warm backlight through the falling confetti, motion blur on the closest pieces.`,
];

/**
 * Builds the full prompt for a given day of week (0 = Sunday).
 */
export function buildChampionImagePrompt(dayOfWeek: number): string {
  const themeBase = CHAMPION_THEMES[dayOfWeek % 7];
  return `${themeBase} Wide cinematic landscape composition (16:9), filling the frame edge to edge with no borders. Shot on 35mm film, fine grain, warm dramatic lighting, high detail, photorealistic. Purple and cream colour harmony. NO people, NO faces, NO text, NO letters, NO numbers, NO logos.`;
}
