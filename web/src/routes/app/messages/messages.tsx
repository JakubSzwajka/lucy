import React from 'react';
import { api } from '@/api';
import { DataTable } from '@/components/ui/data-table';
import { columns } from './columns';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const HeaderActions = () => {
  const { toast } = useToast();
  const [deleteMessages] = api.useDeleteMessageMutation();

  const handleRemoveAll = async () => {
    deleteMessages({})
      .unwrap()
      .then(() => {
        toast({
          title: 'Messages Removed',
          description: 'All messages have been removed. 🧹',
        });
      })
      .catch((error) => {
        console.error(error);
        toast({
          title: 'Error',
          description: error.data.message,
          variant: 'destructive',
        });
      });
  };

  return (
    <Dialog>
      <DialogTrigger>
        <Button type="button" size={'sm'}>
          Remove All
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>You are going to remove all messanges!</DialogTitle>
          <DialogDescription>
            Are you sure you want to remove all messages? This might have an
            impact on your assistant's performance.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" onClick={handleRemoveAll}>
              Remove! 💣
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Messages = () => {
  const { data, isLoading } = api.useGetMessagesQuery('');
  // console.log('data', data);
  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <DataTable
        columns={columns}
        data={data.items}
        headerActions={<HeaderActions />}
      />
    </div>
  );
};

export default Messages;
