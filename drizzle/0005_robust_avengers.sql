CREATE TABLE `methodology_library_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectKey` varchar(128) NOT NULL,
	`title` varchar(255) NOT NULL,
	`versionLabel` varchar(120),
	`fileName` varchar(512) NOT NULL,
	`storageKey` varchar(768) NOT NULL,
	`storageUrl` varchar(1024) NOT NULL,
	`sizeBytes` int NOT NULL,
	`contentSha256` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `methodology_library_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tutorial_videos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectKey` varchar(128) NOT NULL,
	`title` varchar(255) NOT NULL,
	`track` enum('tia','concurrent','primavera') NOT NULL,
	`description` text,
	`videoUrl` varchar(2048) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tutorial_videos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `methodology_library_documents` ADD CONSTRAINT `methodology_library_documents_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tutorial_videos` ADD CONSTRAINT `tutorial_videos_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `methodology_library_docs_user_project_created_idx` ON `methodology_library_documents` (`userId`,`projectKey`,`createdAt`);--> statement-breakpoint
CREATE INDEX `tutorial_videos_user_project_track_idx` ON `tutorial_videos` (`userId`,`projectKey`,`track`);