import { Shell } from "@/ui/shell";
import { Portfolio } from "@/ui/portfolio";
import { getPortfolioView } from "@/server/view-models";

export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getPortfolioView();
  return (
    <Shell active="portfolio" crumb="Portfolio">
      <Portfolio view={view} />
    </Shell>
  );
}
