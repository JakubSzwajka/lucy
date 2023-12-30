import { Controller, Get, Param } from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { NotionService } from "../services/notionClient";
import { PageBlock } from "../services/blockInterpreter";
import { env } from "../../../env";


type ProjectPage = {
    properties: {
        Tasks: {
            relation: {
                id: string
            }[]
        }
    }
}

type TaskPage = {
    properties: {
        "Task name": {
            title: {
                plain_text: string
            }[]
        }
    }
}


@Controller("projects")
@ApiBearerAuth("JWT-auth")
export class ProjectsController {
  constructor(private readonly notion: NotionService) {}

  @Get()
  public async getProjects() {
    try {
      return await this.notion.databases.query({
        database_id: env.PROJECTS_DATABASE_ID as string,
      });
    } catch (e) {
      console.error(e);
      return e;
    }
  }

  @Get(":projectId")
    public async getProject(@Param("projectId") projectId: string) {
        try {
        const project = await this.notion.pages.retrieve({
            page_id: projectId
        }) as unknown as ProjectPage;
        const subTasksIds = project.properties.Tasks.relation.map(task => task.id)
        const subTasksMarkdown = await Promise.all(subTasksIds.map(async taskId => {
            const taskPage = await this.notion.pages.retrieve({
                page_id: taskId
            }) as unknown as TaskPage;
            const task = await this.notion.blocks.children.list({
                block_id: taskId
            })
            return {
                id: taskId,
                page: taskPage,
                // page: taskPage.properties["Task name"].title.map(title => title.plain_text).join(""),
                markdown: new PageBlock(task.results).toMarkdown()
            }
        }))

        const projectPage = await this.notion.blocks.children.list({
            block_id: projectId
        })
        const projectPageMarkdown = new PageBlock(projectPage.results).toMarkdown();
        return {
            project,
            projectPage: projectPageMarkdown,
            subTasksPages: subTasksMarkdown
        }
        } catch (e) {
        console.error(e);
        return e;
        }
    }
}
