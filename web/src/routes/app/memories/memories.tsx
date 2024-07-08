import { api } from '@/api';
import { DataTable } from '@/components/ui/data-table';
import { columns } from './columns';
import { useToast } from '@/components/ui/use-toast';
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

const HeaderActions = () => {
  const { toast } = useToast();
  const [deleteMemories] = api.useDeleteMemoriesMutation();

  const handleRemoveAll = async () => {
    deleteMemories({})
      .unwrap()
      .then(() => {
        toast({
          title: 'Memories Removed',
          description: 'All memories have been removed. 🧹',
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
          <DialogTitle>You are going to remove all memories!</DialogTitle>
          <DialogDescription>
            Are you sure you want to remove all memories? This might have an
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

const Memories = () => {
  const { data, isLoading } = api.useGetMemoriesQuery('');

  if (isLoading || !data) {
    return <div>Loading...</div>;
  }

  return (
    <DataTable
      columns={columns}
      data={data.items}
      headerActions={<HeaderActions />}
    />
  );
};

export default Memories;
