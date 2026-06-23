ALTER TABLE `agents` ADD `memoryContent` text;--> statement-breakpoint
ALTER TABLE `agents` ADD `memoryApprovalRequired` boolean DEFAULT true NOT NULL;
