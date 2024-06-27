import { api } from '@/api';
import React from 'react';
import { Loader } from '@/components/ui/loader';
import NoAssistant from './noAssistant';
import AssistantSummary from './Assistant';

const Home: React.FC = () => {
  const { data, isLoading } = api.useActiveAgentQuery('');

  return (
    <Loader loading={isLoading}>
      {data?.name ? <AssistantSummary assistant={data} /> : <NoAssistant />}
    </Loader>
  );
};

export default Home;

// ---------------------------------------------
// | Welcome Message                          |
// |-------------------------------------------|
// | AI Assistant Summary                     |
// |-------------------------------------------|
// | Integration Summary                      |
// |-------------------------------------------|
// | Recent Activities                        |
// |-------------------------------------------|
// | Upcoming Tasks and Events                |
// |-------------------------------------------|
// | Performance Metrics                      |
// |-------------------------------------------|
// | Notifications/Alerts                     |
// |-------------------------------------------|
// | Tips and Recommendations                 |
// ---------------------------------------------
