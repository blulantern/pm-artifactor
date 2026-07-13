import { Shell } from "@/ui/shell";
import { Portfolio } from "@/ui/portfolio";
import { getPortfolioView } from "@/server/view-models";
import { getManageOptions } from "@/server/ppm/manage-view";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, options] = await Promise.all([getPortfolioView(), getManageOptions()]);
  return (
    <Shell active="portfolio" crumb="Portfolio">
      <Portfolio view={view} options={options} />
    </Shell>
  );
}
