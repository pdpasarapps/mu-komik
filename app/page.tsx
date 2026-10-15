import HomePageClient from "./homepage-client";
import { getHomepageArticles, getHomepageCatalog } from "@/lib/homepage-data";

export default async function HomePage() {
  const [catalog, articles] = await Promise.all([getHomepageCatalog(), getHomepageArticles()]);
  return <HomePageClient {...catalog} articles={articles} />;
}
