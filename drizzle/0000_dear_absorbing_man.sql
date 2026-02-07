CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`parent_id` text,
	`source_call_id` text,
	`name` text NOT NULL,
	`task` text,
	`system_prompt` text,
	`model` text,
	`config` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`waiting_for_call_id` text,
	`result` text,
	`error` text,
	`turn_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agents_session_idx` ON `agents` (`session_id`);--> statement-breakpoint
CREATE INDEX `agents_parent_idx` ON `agents` (`parent_id`);--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`credentials` text,
	`config` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`type` text NOT NULL,
	`role` text,
	`content` text,
	`call_id` text,
	`tool_name` text,
	`tool_args` text,
	`tool_status` text,
	`tool_output` text,
	`tool_error` text,
	`reasoning_summary` text,
	`reasoning_content` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `items_agent_seq_idx` ON `items` (`agent_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `items_call_id_idx` ON `items` (`call_id`);--> statement-breakpoint
CREATE TABLE `mcp_servers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`transport_type` text NOT NULL,
	`command` text,
	`args` text,
	`env` text,
	`url` text,
	`headers` text,
	`require_approval` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`icon_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plan_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`description` text NOT NULL,
	`assigned_agent_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`result` text,
	`error` text,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `plan_steps_plan_idx` ON `plan_steps` (`plan_id`);--> statement-breakpoint
CREATE INDEX `plan_steps_agent_idx` ON `plan_steps` (`assigned_agent_id`);--> statement-breakpoint
CREATE INDEX `plan_steps_plan_seq_idx` ON `plan_steps` (`plan_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `plans_session_idx` ON `plans` (`session_id`);--> statement-breakpoint
CREATE INDEX `plans_agent_idx` ON `plans` (`agent_id`);--> statement-breakpoint
CREATE TABLE `session_mcp_servers` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`mcp_server_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mcp_server_id`) REFERENCES `mcp_servers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `session_mcp_session_idx` ON `session_mcp_servers` (`session_id`);--> statement-breakpoint
CREATE INDEX `session_mcp_server_idx` ON `session_mcp_servers` (`mcp_server_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`root_agent_id` text,
	`title` text DEFAULT 'New Chat' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`default_model_id` text,
	`default_system_prompt_id` text,
	`enabled_models` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `system_prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
