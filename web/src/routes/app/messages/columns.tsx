import {
  DataTableColumnHeader,
  DataTableSelectionColumnCell,
  DataTableSelectionColumnHeader,
} from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { ColumnDef } from '@tanstack/react-table';
import { GetMessageSchema } from 'shared-dto';
import { z } from 'zod';

export const columns: ColumnDef<z.infer<typeof GetMessageSchema>>[] = [
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
    accessorKey: 'type',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: (row) => {
      const type = row.getValue() as string;
      return <Badge>{type}</Badge>;
    },
  },
  {
    accessorFn: (row) => row,
    id: 'message',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Message" />
    ),
    cell: (info) => {
      const type = info.row.original.type;

      switch (type) {
        case 'human':
          return (
            <div className="text-sm text-muted-foreground">
              <b>Human: </b>
              {info.row.original.text}
            </div>
          );
        case 'agent':
          return (
            <div className="text-sm text-muted-foreground">
              <b>AI: </b>
              {info.row.original.text}
            </div>
          );
        case 'tool':
          return (
            <div className="text-sm text-muted-foreground">
              <b>Tool: </b>
              {info.row.original.text}
            </div>
          );
      }
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
