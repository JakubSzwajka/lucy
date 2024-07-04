import React from 'react';
import { api } from '@/api';
import { DataTable } from '@/components/ui/data-table';
import { columns } from './columns';

const Skills = () => {
  const { data, isLoading } = api.useGetSkillsQuery('');
  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <DataTable columns={columns} data={data.items} />
      {/* <CreateSkill/> */}
    </div>
  );
};
export default Skills;
