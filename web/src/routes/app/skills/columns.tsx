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
    accessorKey: 'id',
    header: 'ID',
  },
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'description',
    header: 'Description',
  },
  {
    accessorKey: 'tool',
    header: 'Tool',
  },
];
