import { ColumnDef } from '@tanstack/react-table';

export type Message = {
  id: string;
  date: string;
  source: string;
  human: string;
  agent: string;
  createdAt: string;
};

export const columns: ColumnDef<Message>[] = [
  {
    accessorKey: 'createdAt',
    header: 'Date',
    cell: (row) => {
      const createdAt = row.getValue() as string;
      return new Date(createdAt).toLocaleString();
    },
  },
  {
    accessorKey: 'source',
    header: 'Source',
  },
  {
    accessorKey: 'human',
    header: 'Human',
  },
  {
    accessorKey: 'agent',
    header: 'Agent',
  },
];
