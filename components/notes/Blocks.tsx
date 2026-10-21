import type { Block, Span } from "@/lib/notion/types";

// Renders the stored Notion block tree as plain React (server component, no client JS).
const S = ({ spans }: { spans?: Span[] }) => (
  <>
    {(spans ?? []).map((s, i) => {
      let n: React.ReactNode = s.s;
      if (s.c) n = <code className="rounded-sm bg-white/10 px-1 font-mono text-[0.9em]">{n}</code>;
      if (s.b) n = <strong>{n}</strong>;
      if (s.i) n = <em>{n}</em>;
      if (s.st) n = <s>{n}</s>;
      if (s.u) n = <u>{n}</u>;
      if (s.href) n = <a href={s.href} target="_blank" rel="noreferrer" className="text-teal underline decoration-dotted">{n}</a>;
      return <span key={i}>{n}</span>;
    })}
  </>
);

function List({ items, ordered }: { items: Block[]; ordered: boolean }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={`my-2 space-y-1 pl-6 ${ordered ? "list-decimal" : "list-disc"}`}>
      {items.map((b, i) => (
        <li key={i}>
          <S spans={b.text} />
          {b.children && <Blocks blocks={b.children} />}
        </li>
      ))}
    </Tag>
  );
}

export default function Blocks({ blocks }: { blocks: Block[] }) {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.t === "ul" || b.t === "ol") {
      const run = [b];
      while (blocks[i + 1]?.t === b.t) run.push(blocks[++i]);
      out.push(<List key={i} items={run} ordered={b.t === "ol"} />);
      continue;
    }
    switch (b.t) {
      case "p": out.push(<p key={i} className="my-2 leading-relaxed"><S spans={b.text} /></p>); break;
      case "h1": out.push(<h2 key={i} className="mb-2 mt-6 text-2xl font-light"><S spans={b.text} /></h2>); break;
      case "h2": out.push(<h3 key={i} className="mb-1 mt-5 text-xl font-light"><S spans={b.text} /></h3>); break;
      case "h3": out.push(<h4 key={i} className="mb-1 mt-4 text-base font-medium text-teal/90"><S spans={b.text} /></h4>); break;
      case "todo": out.push(<div key={i} className="my-1 flex gap-2"><span aria-hidden>{b.checked ? "☑" : "☐"}</span><span className={b.checked ? "text-muted line-through" : ""}><S spans={b.text} /></span></div>); break;
      case "quote": out.push(<blockquote key={i} className="my-3 border-l-2 border-violet/60 pl-3 italic text-muted"><S spans={b.text} /></blockquote>); break;
      case "callout": out.push(<div key={i} className="my-3 flex gap-2 rounded-sm border border-line bg-white/[0.03] p-3"><span aria-hidden>{b.icon ?? "💡"}</span><div><S spans={b.text} /></div></div>); break;
      case "code": out.push(<pre key={i} className="my-3 overflow-x-auto rounded-sm border border-line bg-black/30 p-3 font-mono text-xs"><code>{b.text?.[0]?.s}</code></pre>); break;
      case "equation": out.push(<pre key={i} className="my-3 overflow-x-auto font-mono text-sm text-teal/90">{b.text?.[0]?.s}</pre>); break;
      case "hr": out.push(<hr key={i} className="my-4 border-line" />); break;
      case "toggle": out.push(<details key={i} className="my-2"><summary className="cursor-pointer"><S spans={b.text} /></summary><div className="pl-4">{b.children && <Blocks blocks={b.children} />}</div></details>); break;
      // eslint-disable-next-line @next/next/no-img-element
      case "image": out.push(<figure key={i} className="my-3"><img src={b.url} alt={b.caption || ""} loading="lazy" className="max-w-full rounded-sm border border-line" />{b.caption && <figcaption className="micro mt-1 normal-case tracking-wide">{b.caption}</figcaption>}</figure>); break;
      case "link": out.push(<p key={i} className="my-2"><a href={b.url} target="_blank" rel="noreferrer" className="text-teal underline decoration-dotted">{b.caption || b.url}</a></p>); break;
      case "page": out.push(<p key={i} className="my-2 text-muted">↳ Sub-page: <S spans={b.text} /> <span className="micro">(open in Notion)</span></p>); break;
      case "table":
        out.push(
          <div key={i} className="my-3 overflow-x-auto"><table className="w-full border-collapse text-sm"><tbody>
            {(b.rows ?? []).map((r, ri) => (
              <tr key={ri} className={b.header && ri === 0 ? "bg-white/5 font-medium" : ""}>
                {r.map((c, ci) => <td key={ci} className="border border-line px-2 py-1"><S spans={c} /></td>)}
              </tr>
            ))}
          </tbody></table></div>,
        );
        break;
    }
  }
  return <>{out}</>;
}
