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
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'description',
    header: 'Description',
  },
  {
    accessorKey: 'parameters',
    header: 'Parameters',
  },
];
