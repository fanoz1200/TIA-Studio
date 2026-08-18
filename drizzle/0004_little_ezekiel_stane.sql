CREATE TABLE `project_invitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`projectKey` varchar(128) NOT NULL,
	`email` varchar(320) NOT NULL,
	`projectRole` enum('planner','contracts','claims_manager','viewer') NOT NULL DEFAULT 'viewer',
	`tokenHash` varchar(64) NOT NULL,
	`status` enum('pending','accepted','cancelled','expired') NOT NULL DEFAULT 'pending',
	`expiresAt` timestamp NOT NULL,
	`acceptedByUserId` int,
	`acceptedAt` timestamp,
	`sentBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_invitations_owner_project_email_uq` UNIQUE(`ownerUserId`,`projectKey`,`email`),
	CONSTRAINT `project_invitations_token_hash_uq` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `project_invitations` ADD CONSTRAINT `project_invitations_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_invitations` ADD CONSTRAINT `project_invitations_acceptedByUserId_users_id_fk` FOREIGN KEY (`acceptedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_invitations` ADD CONSTRAINT `project_invitations_sentBy_users_id_fk` FOREIGN KEY (`sentBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `project_invitations_owner_project_status_idx` ON `project_invitations` (`ownerUserId`,`projectKey`,`status`);