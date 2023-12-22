import { PartialBlockObjectResponse, BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

type Heading1Block = {
    type: 'heading_1',
    heading_1: {
        rich_text: Array<{
            type: 'text',
            text: {
                content: string,
            }
        }>
    }
}

type Heading2Block = {
    type: 'heading_2',
    heading_2: {
        rich_text: Array<{
            type: 'text',
            text: {
                content: string,
            }
        }>
    }
}

type Heading3Block = {
    type: 'heading_3',
    heading_3: {
        rich_text: Array<{
            type: 'text',
            text: {
                content: string,
            }
        }>
    }
}

type ParagraphBlock = {
    type: 'paragraph',
    paragraph: {
        rich_text: Array<{
            type: 'text',
            text: {
                content: string,
            }
        }>
    }
}

type BulletedListItemBlock = {
    type: 'bulleted_list_item',
    bulleted_list_item: {
        rich_text: Array<{
            type: 'text',
            text: {
                content: string,
            }
        }>
    }
}

type Block = Heading1Block | Heading2Block | Heading3Block | ParagraphBlock | BulletedListItemBlock;

export class PageBlock {
    constructor(
        public readonly obj: Array<PartialBlockObjectResponse | BlockObjectResponse>, 
    ) {}


    toMarkdown() {
        let markdown = '';
        for (const block of this.obj) {
            markdown += this.blockToMarkdown(block as Block);
        }
        return markdown;
    }

    blockToMarkdown(block: Block) {
        let markdown = '';
         if (block.type === 'heading_1') {
            markdown += this.heading1ToMarkdown(block);
        } else if (block.type === 'heading_2') {
            markdown += this.heading2ToMarkdown(block);
        } else if (block.type === 'heading_3') {
            markdown += this.heading3ToMarkdown(block);
        }   else if (block.type === 'paragraph') {
            markdown += this.paragraphToMarkdown(block);
        } else if (block.type === 'bulleted_list_item') {
            markdown += this.bulletedListItemToMarkdown(block);
        }
            // } else if (block.type === 'numbered_list_item') {
        //     markdown += this.numberedListItemToMarkdown(block);
        // } else if (block.type === 'to_do') {
        //     markdown += this.todoToMarkdown(block);
        // } else if (block.type === 'toggle') {
        //     markdown += this.toggleToMarkdown(block);
        // } else if (block.type === 'child_page') {
        //     markdown += this.childPageToMarkdown(block);
        // } else if (block.type === 'unsupported') {
        //     markdown += this.unsupportedToMarkdown(block);
        // } else {
        //     markdown += this.unsupportedToMarkdown(block);
        // }
        return markdown;
    }

    heading1ToMarkdown(block: Heading1Block) {
        let markdown = '';
        for (const text of block.heading_1.rich_text) {
            markdown += `# ${text.text.content}`;
        }
        markdown += '\n\n';
        return markdown;
    }

    heading2ToMarkdown(block: Heading2Block) {
        let markdown = '';
        for (const text of block.heading_2.rich_text) {
            markdown += `## ${text.text.content}`;
        }
        markdown += '\n\n';
        return markdown;
    }

    heading3ToMarkdown(block: Heading3Block) {
        let markdown = '';
        for (const text of block.heading_3.rich_text) {
            markdown += `### ${text.text.content}`;
        }
        markdown += '\n\n';
        return markdown;
    }

    paragraphToMarkdown(block: ParagraphBlock) {
        let markdown = '';
        for (const text of block.paragraph.rich_text) {
            markdown += `${text.text.content}`;
        }
        markdown += '\n\n';
        return markdown;
    }

    bulletedListItemToMarkdown(block: BulletedListItemBlock) {
        let markdown = '';
        for (const text of block.bulleted_list_item.rich_text) {
            markdown += `* ${text.text.content}`;
        }
        markdown += '\n\n';
        return markdown;
    }
}