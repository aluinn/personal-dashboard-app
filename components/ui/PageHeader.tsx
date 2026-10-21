export default function PageHeader({ code, title }: { code: string; title: string }) {
  return (
    <div className="mb-6">
      <div className="micro text-teal/80">{code}</div>
      <h1 className="mt-1 text-2xl font-light tracking-wide">{title}</h1>
    </div>
  );
}
