/**
 * JsonLd — renders one <script type="application/ld+json"> tag.
 * Server component: pass a single JSON-LD object or an array graph
 * (e.g. the output of childPageJsonLd()). Objects are serialized
 * verbatim; builders in lib/seo.ts own the schema shapes.
 */
export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
