import {
  DataTableColumnHeader,
  DataTableSelectionColumnCell,
  DataTableSelectionColumnHeader,
} from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { ColumnDef } from '@tanstack/react-table';

export type Message = {
  id: string;
  date: string;
  source: string;
  human: string;
  agent: string;
  conversationId: string;
  createdAt: string;
};

export const columns: ColumnDef<Message>[] = [
  {
    id: 'select',
    header: DataTableSelectionColumnHeader,
    cell: DataTableSelectionColumnCell,
  },
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
    accessorFn: (row) => row,
    id: 'message',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Message" />
    ),
    cell: (info) => {
      return (
        <div>
          <div className="text-sm text-muted-foreground">
            <b>Human: </b>
            {info.row.original.human}
          </div>
          <div className="text-sm text-muted-foreground">
            <b>AI: </b>
            {info.row.original.agent}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: 'source',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Source" />
    ),
    cell: (row) => {
      const source = row.getValue() as string;
      return <Badge variant="outline">{source}</Badge>;
    },
  },
  {
    accessorKey: 'conversationId',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Conversation ID" />
    ),
    cell: (row) => {
      const conversationId = row.getValue() as string;
      return <Badge variant="outline">{conversationId}</Badge>;
    },
  },
];
