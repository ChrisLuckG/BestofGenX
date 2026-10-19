// /article/<id>/<title-slug> - the readable, canonical URL (lib/articleUrl.ts). The same page as /article/<id>; the
// slug is only for people and search engines, the id finds the article (a changed title never breaks a link).
export { default, generateMetadata } from "../page";
