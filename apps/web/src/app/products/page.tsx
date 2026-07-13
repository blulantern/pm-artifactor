import { Shell } from "@/ui/shell";
import { Products } from "@/ui/products";
import { getProductsView } from "@/server/view-models";
import { getManageOptions } from "@/server/ppm/manage-view";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, options] = await Promise.all([getProductsView(), getManageOptions()]);
  return (
    <Shell active="products" crumb="Products">
      <Products view={view} options={options} />
    </Shell>
  );
}
