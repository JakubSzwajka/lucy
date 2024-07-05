import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { MemoryRowActions } from './rowActions';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { MessageCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Message, columns as MessagesColumns } from '../messages/columns';

export type Memory = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
};

export const columns: ColumnDef<Memory>[] = [
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: (row) => {
      const createdAt = row.getValue() as string;
      return (
        <div className="ml-auto text-xs text-muted-foreground">
          {new Date(createdAt).toLocaleString()}
        </div>
      );
    },
  },
  {
    accessorKey: 'text',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Memory" />
    ),
  },
  {
    id: 'messages',
    accessorFn: (row) => row,
    cell: (row) => {
      return (
        <Drawer>
          <DrawerTrigger>
            <MessageCircleIcon className="h-4 w-4" />
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Messages</DrawerTitle>
              <DrawerDescription>
                Messages associated with this memory
              </DrawerDescription>
            </DrawerHeader>
            <div className="p-4">
              <DataTable
                data={row.row.original.messages}
                columns={MessagesColumns}
              />
            </div>
            <DrawerFooter>
              <DrawerClose>
                <Button>Close</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <MemoryRowActions memoryId={row.original.id} />,
  },
];
