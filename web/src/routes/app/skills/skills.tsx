import React from 'react';
import { api } from '@/api';
import { DataTable } from '@/components/ui/data-table';
import { columns } from './columns';
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { JsonEditor } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';

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

const _CreateSkill = () => {
  const { toast } = useToast();
  const [createSkill] = api.useCreateSkillMutation();
  const formSchema = z
    .object({
      name: z.string(),
      description: z.string(),
      parameters: z.string(),
    })
    .refine(
      (data) => {
        try {
          JSON.parse(data.parameters);
          return true;
        } catch (error) {
          return false;
        }
      },
      {
        message: 'Parameters must be a valid JSON object',
        path: ['parameters'],
      }
    )
    .refine((data) => data.description.length > 0, {
      message: 'Description is required',
      path: ['description'],
    })
    .refine((data) => data.name.length > 0, {
      message: 'Name is required',
      path: ['name'],
    });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (data) => {
    console.log(data);

    createSkill(data)
      .unwrap()
      .then(() => {
        form.reset();
        toast({
          title: 'Skill created',
          description: 'Skill was created successfully',
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
    <Drawer>
      <DrawerTrigger>
        <Button>Add new skill 🥷</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>New skill</DrawerTitle>
          <DrawerDescription>
            Give it a name and description. Then adjust parameters accordingly
            to /here goes the link to openai/
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="name">Name</FormLabel>
                    <FormControl>
                      <Input
                        id="name"
                        placeholder="put something meaningful here"
                        {...form.register('name')}
                      />
                    </FormControl>
                    <FormMessage {...field} />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="description">Description</FormLabel>
                    <FormControl>
                      <Input
                        id="description"
                        //   placeholder="what does this skill do?"
                        {...form.register('description')}
                      />
                    </FormControl>
                    <FormMessage {...field} />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="parameters"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="parameters">Parameters</FormLabel>
                    <FormControl>
                      <JsonEditor
                        id="parameters"
                        placeholder="parameters"
                        {...form.register('parameters')}
                      />
                    </FormControl>
                    <FormMessage {...field} />
                  </FormItem>
                )}
              />
              <Button type="submit">Create</Button>
            </form>
          </Form>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose>Cancel</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default Skills;
