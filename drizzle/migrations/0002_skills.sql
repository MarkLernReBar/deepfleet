CREATE TABLE `skills` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(120) NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text,
	`content` text NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `skills_id` PRIMARY KEY(`id`),
	CONSTRAINT `skills_slug_unique` UNIQUE(`slug`)
);
