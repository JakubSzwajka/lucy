const Link = ({
  children,
  ...props
}: {
  children: React.ReactNode;
  href: string;
  className?: string;
}) => (
  <a className="text-primary hover:underline" {...props}>
    {children}
  </a>
);
export { Link };
