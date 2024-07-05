import { DataTableColumnHeader } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { MemoryRowActions } from './rowActions';

export type Memory = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
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
    id: 'actions',
    cell: ({ row }) => <MemoryRowActions memoryId={row.original.id} />,
  },
];
