import {
  DataTableColumnHeader,
  DataTableSelectionColumnCell,
  DataTableSelectionColumnHeader,
} from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { CheckCircleIcon } from 'lucide-react';
import { CrossCircledIcon } from '@radix-ui/react-icons';
import { Badge } from '@/components/ui/badge';
import { SkillRowActions } from './rowActions';

export type Skill = {
  name: string;
  description: string;
  active: boolean;
};

export const columns: ColumnDef<Skill>[] = [
  {
    id: 'select',
    header: DataTableSelectionColumnHeader,
    cell: DataTableSelectionColumnCell,
  },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: (row) => {
      return <Badge>{row.getValue() as string}</Badge>;
    },
  },
  {
    accessorKey: 'description',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Description" />
    ),
  },
  {
    id: 'active',
    accessorFn: (row) => row,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Active" />
    ),
    cell: (row) => {
      const { active } = row.getValue() as { active: boolean };
      const label = active ? 'Active' : 'Inactive';
      const icon = active ? (
        <CheckCircleIcon className="mr-2 h-4 w-4 text-muted-foreground" />
      ) : (
        <CrossCircledIcon className="mr-2 h-4 w-4 text-muted-foreground" />
      );

      return (
        <div className="flex w-[100px] items-center">
          {icon}
          <span>{label}</span>
        </div>
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const skillId = row.original.name;
      return <SkillRowActions skillId={skillId} />;
    },
  },
];
