CREATE TABLE `agentTools` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`toolId` int NOT NULL,
	`requiresApproval` boolean,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agentTools_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fleetId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text,
	`identityType` enum('claw','assistant') NOT NULL DEFAULT 'claw',
	`modelProvider` varchar(48) NOT NULL DEFAULT 'openai',
	`model` varchar(120) NOT NULL DEFAULT 'gpt-5',
	`systemPrompt` text,
	`status` enum('draft','active','paused','archived') NOT NULL DEFAULT 'draft',
	`harness` json,
	`skills` json,
	`memory` json,
	`credentialId` int,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`agentId` int NOT NULL,
	`stepId` int,
	`toolName` varchar(160) NOT NULL,
	`args` json,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`decidedBy` int,
	`decidedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`provider` varchar(80) NOT NULL,
	`kind` enum('api_key','oauth') NOT NULL DEFAULT 'api_key',
	`scope` enum('shared','per_user') NOT NULL DEFAULT 'shared',
	`secretMasked` varchar(120),
	`secretValue` text,
	`ownerId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credentials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fleets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text,
	`color` varchar(16) DEFAULT '#3f3f46',
	`ownerId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fleets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `runSteps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`idx` int NOT NULL,
	`type` enum('plan','tool_call','tool_result','subagent','message') NOT NULL,
	`name` varchar(160),
	`content` json,
	`status` enum('running','done','error','awaiting_approval') NOT NULL DEFAULT 'done',
	`durationMs` int NOT NULL DEFAULT 0,
	`tokens` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `runSteps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`fleetId` int NOT NULL,
	`input` text NOT NULL,
	`output` text,
	`status` enum('queued','running','awaiting_approval','succeeded','failed','cancelled') NOT NULL DEFAULT 'queued',
	`model` varchar(120),
	`promptTokens` int NOT NULL DEFAULT 0,
	`completionTokens` int NOT NULL DEFAULT 0,
	`totalTokens` int NOT NULL DEFAULT 0,
	`costMicroUsd` bigint NOT NULL DEFAULT 0,
	`errorMessage` text,
	`triggeredBy` int NOT NULL,
	`startedAt` timestamp,
	`endedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`principalType` enum('user','workspace') NOT NULL DEFAULT 'user',
	`principalUserId` int,
	`role` enum('viewer','can-run','can-edit','can-clone','owner') NOT NULL,
	`grantedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shares_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subagents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`prompt` text,
	`model` varchar(120),
	`tools` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subagents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tools` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`description` text,
	`type` enum('builtin','mcp') NOT NULL DEFAULT 'builtin',
	`config` json,
	`requiresApproval` boolean NOT NULL DEFAULT false,
	`isAvailable` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tools_id` PRIMARY KEY(`id`),
	CONSTRAINT `tools_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE INDEX `agenttools_agent_idx` ON `agentTools` (`agentId`);--> statement-breakpoint
CREATE INDEX `agents_fleet_idx` ON `agents` (`fleetId`);--> statement-breakpoint
CREATE INDEX `agents_creator_idx` ON `agents` (`createdBy`);--> statement-breakpoint
CREATE INDEX `approvals_status_idx` ON `approvals` (`status`);--> statement-breakpoint
CREATE INDEX `approvals_run_idx` ON `approvals` (`runId`);--> statement-breakpoint
CREATE INDEX `credentials_owner_idx` ON `credentials` (`ownerId`);--> statement-breakpoint
CREATE INDEX `fleets_owner_idx` ON `fleets` (`ownerId`);--> statement-breakpoint
CREATE INDEX `runsteps_run_idx` ON `runSteps` (`runId`);--> statement-breakpoint
CREATE INDEX `runs_agent_idx` ON `runs` (`agentId`);--> statement-breakpoint
CREATE INDEX `runs_status_idx` ON `runs` (`status`);--> statement-breakpoint
CREATE INDEX `runs_created_idx` ON `runs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `shares_agent_idx` ON `shares` (`agentId`);--> statement-breakpoint
CREATE INDEX `subagents_agent_idx` ON `subagents` (`agentId`);