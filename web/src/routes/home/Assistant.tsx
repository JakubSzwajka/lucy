import React from 'react';
import { api } from '@/api';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { useToast } from '@/components/ui/use-toast';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const AssistantSummary = ({
  assistant,
}: {
  assistant: {
    id: string;
    name: string;
    defaultPrompt: string;
  };
}) => {
  const { toast } = useToast();
  const [updateAgent, { isLoading }] = api.useUpdateAgentMutation();
  const formSchema = z.object({
    name: z.string(),
    defaultPrompt: z.string(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: assistant.name,
      defaultPrompt: assistant.defaultPrompt,
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    updateAgent({
      id: assistant.id,
      ...data,
    })
      .unwrap()
      .then(() => {
        toast({
          title: 'Assistant Updated',
          description: 'Your assistant has been updated',
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
    <Card>
      <CardHeader>
        <CardTitle>AI Assistant Summary</CardTitle>
        <CardDescription>
          Your assistant is a virtual agent that can help you with your tasks
          and answer your questions.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-8">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assistant Name</FormLabel>
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
            <FormField
              control={form.control}
              name="defaultPrompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Prompt</FormLabel>
                  <FormControl>
                    <Textarea
                      id="defaultPrompt"
                      placeholder="Default Prompt"
                      autoComplete="defaultPrompt"
                      disabled={false}
                      rows={50}
                      {...form.register('defaultPrompt')}
                    />
                  </FormControl>
                  <FormMessage {...field} />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button disabled={isLoading}>
              {isLoading && (
                <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
              )}
              Update
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
};

export default AssistantSummary;
