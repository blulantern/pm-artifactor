import { Shell } from "@/ui/shell";
import { ProductDetail } from "@/ui/products";
import { getProductView } from "@/server/view-models";
import { isRecordNotFound } from "@/server/errors";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let view: Awaited<ReturnType<typeof getProductView>>;
  try {
    view = await getProductView(id);
  } catch (err) {
    if (!isRecordNotFound(err)) throw err; // real DB errors must surface, not 404
    return (
      <Shell active="products" crumb="Product not found">
        <div className="view">
          <div className="h1">Product not found</div>
          <div className="sub" style={{ marginTop: 6 }}>
            No product matches &ldquo;{id}&rdquo;. It may have been removed or the link is stale.
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell active="products" crumb={view.name}>
      <ProductDetail view={view} />
    </Shell>
  );
}
