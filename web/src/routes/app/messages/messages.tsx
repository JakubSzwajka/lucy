import { api } from '@/api';
import { DataTable } from '@/components/ui/data-table';
import { columns } from './columns';

const Messages = () => {
  const { data, isLoading } = api.useGetMessagesQuery('');
  // console.log('data', data);
  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <DataTable columns={columns} data={data.items} />
    </div>
  );
};

export default Messages;
