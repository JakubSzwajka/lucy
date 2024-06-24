import React from 'react';
import { useRouteError } from 'react-router-dom';

const NotFound: React.FC = () => {
  const error = useRouteError() as {
    statusText: string;
    message: string;
  };
  console.error(error);
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <h1 className="text-5xl font-bold text-gray-800 mb-4">Oops!</h1>
      <p className="text-lg text-gray-600 mb-2">
        Sorry, an unexpected error has occurred.
      </p>
      <p className="text-md text-gray-500">
        <i>{error.statusText || error.message}</i>
      </p>
    </div>
  );
};

export default NotFound;
