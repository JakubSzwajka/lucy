import { Icons } from './icons';

const Loader = ({ loading = false, children }) => {
  if (loading) {
    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />;
  }

  return children;
};

export { Loader };
