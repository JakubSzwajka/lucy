import React from 'react';
import { api } from '@/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '../../components/ui/form';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Icons } from '../../components/ui/icons';
import { useToast } from '../../components/ui/use-toast';

const NoAssistant: React.FC = () => {
  const [createAgent, { isLoading }] = api.useCreateAgentMutation();
  const { toast } = useToast();
  const formSchema = z.object({
    name: z.string(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createAgent(data)
      .unwrap()
      .then(() => {
        toast({
          title: 'Assistant Created',
          description: 'Your assistant has been created',
        });
      })
      .catch((error) => {
        console.error(error);
        toast({
          title: 'Error',
          description: error.data.message,
          variant: 'destructive',
        });
      });
  };

  return (
    <div className="flex items-center justify-center h-full">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Your Assistant</CardTitle>
          <CardDescription>
            You do not have an assistant yet. Create one to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        id="name"
                        placeholder="Assistant Name"
                        type="text"
                        autoComplete="name"
                        disabled={false}
                        {...form.register('name')}
                      />
                    </FormControl>
                    <FormMessage {...field} />
                  </FormItem>
                )}
              />
              <Button disabled={isLoading} className="w-full">
                {isLoading && (
                  <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create!
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default NoAssistant;
