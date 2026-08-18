CREATE TABLE `project_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`projectKey` varchar(128) NOT NULL,
	`memberUserId` int NOT NULL,
	`projectRole` enum('planner','contracts','claims_manager','viewer') NOT NULL DEFAULT 'viewer',
	`addedBy` int NOT NULL,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_members_owner_project_member_uq` UNIQUE(`ownerUserId`,`projectKey`,`memberUserId`)
);
--> statement-breakpoint
ALTER TABLE `project_members` ADD CONSTRAINT `project_members_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_members` ADD CONSTRAINT `project_members_memberUserId_users_id_fk` FOREIGN KEY (`memberUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_members` ADD CONSTRAINT `project_members_addedBy_users_id_fk` FOREIGN KEY (`addedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `project_members_member_project_idx` ON `project_members` (`memberUserId`,`projectKey`);