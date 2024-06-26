import { ColumnDef } from '@tanstack/react-table';

export type Message = {
  id: string;
  date: string;
  source: string;
  human: string;
  agent: string;
};

export const columns: ColumnDef<Message>[] = [
  {
    accessorKey: 'date',
    header: 'Date',
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
