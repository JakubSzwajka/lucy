import { api } from '@/api';
import React from 'react';

const Home: React.FC = () => {
  const { data } = api.useGetMessagesQuery('');

  console.log('data', data);

  return (
    <div className="flex items-center justify-center h-full">
      <h1 className="text-3xl font-semibold text-muted-foreground">
        Home - hello!
      </h1>
    </div>
  );
};

export default Home;
