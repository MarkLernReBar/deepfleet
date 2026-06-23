ALTER TABLE `agents` ADD `triggersPaused` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE `agentSchedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text,
	`cronExpression` varchar(120) NOT NULL,
	`prompt` text NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`lastRunAt` timestamp,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agentSchedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `agentschedules_agent_idx` ON `agentSchedules` (`agentId`);--> statement-breakpoint
CREATE TABLE `agentChannels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`type` enum('chat','slack','gmail') NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`config` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agentChannels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `agentchannels_agent_type_idx` ON `agentChannels` (`agentId`,`type`);--> statement-breakpoint
CREATE TABLE `chatThreads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`needsAttention` boolean NOT NULL DEFAULT false,
	`isRead` boolean NOT NULL DEFAULT true,
	`lastMessageAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chatThreads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `chatthreads_agent_idx` ON `chatThreads` (`agentId`);--> statement-breakpoint
CREATE INDEX `chatthreads_user_idx` ON `chatThreads` (`userId`);--> statement-breakpoint
CREATE TABLE `chatMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`threadId` int NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`runId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chatMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `chatmessages_thread_idx` ON `chatMessages` (`threadId`);
