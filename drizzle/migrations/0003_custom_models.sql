CREATE TABLE `customModels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`modelId` varchar(160) NOT NULL,
	`displayName` varchar(160) NOT NULL,
	`baseUrl` varchar(512) NOT NULL,
	`apiKeyEnvVar` varchar(120) NOT NULL,
	`provider` varchar(80) NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customModels_id` PRIMARY KEY(`id`),
	CONSTRAINT `customModels_modelId_unique` UNIQUE(`modelId`)
);
--> statement-breakpoint
CREATE INDEX `custommodels_creator_idx` ON `customModels` (`createdBy`);
