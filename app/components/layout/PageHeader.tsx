interface PageHeaderProps {
  title: string;
  subtitle: string;
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div className="text-center mb-8 md:mb-12">
      <h1 className="text-4xl md:text-5xl font-bold mb-3 md:mb-4">{title}</h1>
      <p className="text-md md:text-lg text-slate-400">{subtitle}</p>
    </div>
  );
}