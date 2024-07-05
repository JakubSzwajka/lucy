import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import { api } from '@/api';
import { useToast } from '@/components/ui/use-toast';

const MemoryRowActions = ({ memoryId }: { memoryId: string }) => {
  const { toast } = useToast();
  const [deleteMemory] = api.useDeleteMemoryMutation();

  const handleRemoval = () => {
    deleteMemory(memoryId)
      .unwrap()
      .then(() => {
        toast({
          title: 'Memory Removed',
          description: 'The memory has been removed. 🧹',
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
        >
          <DotsHorizontalIcon className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[160px]">
        <DropdownMenuItem onClick={handleRemoval}>Remove</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export { MemoryRowActions };
