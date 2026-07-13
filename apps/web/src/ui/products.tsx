import Link from "next/link";
import { Tag, Eyebrow } from "./primitives.js";
import { EntityFormDisclosure } from "./entity-form-disclosure.js";
import { DeleteButton } from "./delete-dialog.js";
import type { ManageOptions } from "@/server/ppm/manage-view.js";
import type { getProductsView, getProductView } from "@/server/view-models";

type ProductsViewModel = Awaited<ReturnType<typeof getProductsView>>;
type ProductViewModel = Awaited<ReturnType<typeof getProductView>>;

/** Badge color + label per provenance state — mirrors ProvenanceState in @pma/contracts. */
const PROVENANCE_META: Record<string, [string, string]> = {
  manual: ["var(--faint)", "Manual"],
  connected: ["var(--win)", "Connected"],
  formerly_synced: ["var(--amber)", "Formerly synced"],
};

function ProvenanceTag({ state }: { state: string }) {
  const [color, label] = PROVENANCE_META[state] ?? PROVENANCE_META.manual!;
  return <Tag style={{ color, borderColor: color }}>{label}</Tag>;
}

export function Products({ view, options }: { view: ProductsViewModel; options: ManageOptions }) {
  return (
    <div className="view">
      <div className="h1">Products</div>
      <div className="sub" style={{ margin: "3px 0 16px" }}>
        Durable value streams. A product outlives the projects that deliver into it.
      </div>

      <div style={{ marginBottom: 16 }}>
        <EntityFormDisclosure type="product" options={options} label="＋ New product" openLabel="Cancel" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {view.products.map((p) => (
          <div key={p.id} className="card" style={{ padding: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <Link href={`/products/${p.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div className="h2">{p.name}</div>
              </Link>
              <ProvenanceTag state={p.provenance} />
            </div>

            <div style={{ display: "flex", gap: 20, marginBottom: 14 }}>
              <div>
                <Eyebrow>Portfolio</Eyebrow>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>
                  {p.portfolioName ? (
                    <Link href="/portfolio" style={{ color: "var(--teal)", textDecoration: "none" }}>
                      {p.portfolioName}
                    </Link>
                  ) : (
                    <span className="sub">Standalone</span>
                  )}
                </div>
              </div>
              <div>
                <Eyebrow>Status</Eyebrow>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{p.status}</div>
              </div>
              <div>
                <Eyebrow>Delivering projects</Eyebrow>
                <div className="kpi" style={{ fontSize: 19 }}>
                  {p.projectCount}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <EntityFormDisclosure
                type="product"
                options={options}
                label="Edit"
                initial={{ id: p.id, name: p.name, status: p.status, portfolioId: p.portfolioId }}
              />
              <DeleteButton parent={{ type: "product", id: p.id }} label="Delete" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProductDetail({ view }: { view: ProductViewModel }) {
  return (
    <div className="view" style={{ maxWidth: 1000 }}>
      <Link href="/products" style={{ textDecoration: "none" }}>
        <button className="ghost" style={{ marginBottom: 14 }}>
          ← Products
        </button>
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="h1">{view.name}</div>
            <ProvenanceTag state={view.provenance} />
          </div>
          <div className="sub">
            {view.status} ·{" "}
            {view.portfolioName ? (
              <Link href="/portfolio" style={{ color: "var(--teal)", textDecoration: "none" }}>
                {view.portfolioName}
              </Link>
            ) : (
              "Standalone"
            )}
          </div>
        </div>
      </div>

      {view.vision ? (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <Eyebrow style={{ marginBottom: 6 }}>Vision</Eyebrow>
          <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{view.vision}</div>
        </div>
      ) : null}

      <div className="card" style={{ overflow: "hidden" }}>
        <div className="h2" style={{ padding: "14px 16px" }}>
          Delivering projects ({view.projects.length})
        </div>
        {view.projects.length === 0 ? (
          <div className="sub" style={{ padding: "0 16px 16px" }}>
            No projects deliver into this product yet.
          </div>
        ) : (
          view.projects.map((proj) => (
            <Link
              key={proj.id}
              href={`/projects/${proj.id}`}
              style={{ textDecoration: "none", color: "inherit", display: "block" }}
            >
              <div
                className="row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "13px 16px",
                  cursor: "pointer",
                  borderTop: "1px solid var(--line)",
                }}
              >
                <div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{proj.name}</div>
                <Tag>{proj.methodology}</Tag>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>{proj.status}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
