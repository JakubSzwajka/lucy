import { Inbox, LogOut, Rocket } from 'lucide-react';
import React from 'react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { cn } from '@/lib/utils';
import { Separator } from '@radix-ui/react-context-menu';
import { Nav } from './nav';
import { AccountSwitcher } from './accountSwitcher';
import { Outlet, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../App';
import { api } from '@/api';
import { useToast } from '@/components/ui/use-toast';

const accounts = [
  {
    label: 'Lucy',
    description: 'Lucy, your AI assistant',
    icon: <Rocket />,
  },
];

const Root: React.FC = () => {
  const defaultLayout = [265, 440, 655];
  const defaultCollapsed = false;
  const navCollapsedSize = 4;
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [logout] = api.useLogoutMutation();

  const handleLogout = async () => {
    await logout({})
      .unwrap()
      .then(() => {
        toast({
          title: 'Logged Out',
          description: 'You have been logged out',
        });
        navigate(ROUTES.auth.login);
      })
      .catch((error) => {
        console.error(error);
        toast({
          title: 'Error',
          description: error.data.message,
          variant: 'destructive',
        });
        navigate(ROUTES.auth.login);
      });
  };

  return (
    <div className="h-screen">
      <ResizablePanelGroup
        direction="horizontal"
        onLayout={(sizes: number[]) => {
          document.cookie = `react-resizable-panels:layout=${JSON.stringify(
            sizes
          )}`;
        }}
        className="h-full items-stretch"
      >
        <ResizablePanel
          defaultSize={defaultLayout[0]}
          collapsedSize={navCollapsedSize}
          collapsible={true}
          minSize={15}
          maxSize={20}
          onCollapse={() => {
            const collapsed = !isCollapsed;
            setIsCollapsed(collapsed);
            document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(
              collapsed
            )}`;
          }}
          className={cn(
            isCollapsed &&
              'min-w-[50px] transition-all duration-300 ease-in-out'
          )}
        >
          <div className="h-full flex flex-col ">
            <div
              className={cn(
                'flex h-[52px] items-center justify-center',
                isCollapsed ? 'h-[52px]' : 'px-2'
              )}
            >
              <AccountSwitcher isCollapsed={isCollapsed} accounts={accounts} />
            </div>
            <Separator />
            <div className="flex flex-col flex-grow justify-between">
              <Nav
                isCollapsed={isCollapsed}
                links={[
                  {
                    title: 'Messages',
                    icon: Inbox,
                    variant: 'ghost',
                    url: ROUTES.app.messages,
                  },
                ]}
              />
              <Nav
                isCollapsed={isCollapsed}
                links={[
                  {
                    title: 'LogOut',
                    icon: LogOut,
                    variant: 'ghost',
                    onClick: handleLogout,
                    url: ROUTES.auth.login,
                  },
                ]}
              />
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={defaultLayout[1]} minSize={30}>
          <div className="px-8 py-4">
            <Outlet />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default Root;
