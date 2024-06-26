const Link = ({
  children,
  ...props
}: {
  children: React.ReactNode;
  href: string;
  className?: string;
  onClick?: () => void;
}) => (
  <a className="text-primary hover:underline" {...props}>
    {children}
  </a>
);
export { Link };
