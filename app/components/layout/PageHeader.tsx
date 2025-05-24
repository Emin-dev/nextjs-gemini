interface PageHeaderProps {
  title: string;
  subtitle: string;
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div className="text-center mb-10 md:mb-16"> {/* Increased bottom margin */}
      <h1 className="text-4xl md:text-5xl font-bold mb-3 md:mb-4">{title}</h1>
      <p className="text-md md:text-lg text-slate-300">      {/* Changed text color */}
        {subtitle}
      </p>
    </div>
  );
}