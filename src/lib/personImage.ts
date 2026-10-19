// A person's picture in Menschen is THE main picture for everything made about them.
//
// Articles and rankrolls used to get a COPY of the image when they were created, so a
// picture changed in Menschen afterwards never reached them - the article kept showing
// the old one. This pushes a changed picture to every article (cover + thumbnail) and
// rankroll (cover) that points at the person via personRef.
import Article from '@/models/Article';
import Poll from '@/models/Poll';

export async function syncPersonImage(personId: string, image: string): Promise<{ articles: number; polls: number }> {
  if (!personId || !image) return { articles: 0, polls: 0 };
  const [articles, polls] = await Promise.all([
    // The focal point belonged to the OLD picture; a new one starts centred.
    Article.updateMany({ personRef: personId }, { $set: { coverImage: image, thumbnailUrl: image, imagePosX: 50, imagePosY: 50 } }),
    Poll.updateMany({ personRef: personId }, { $set: { image } }),
  ]);
  return { articles: articles.modifiedCount, polls: polls.modifiedCount };
}
