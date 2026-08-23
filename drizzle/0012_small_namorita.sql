CREATE TABLE `training_references` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`projectKey` varchar(128) NOT NULL,
	`referenceKey` varchar(128) NOT NULL,
	`title` varchar(255) NOT NULL,
	`sourceKind` enum('user_provided_private') NOT NULL DEFAULT 'user_provided_private',
	`baselineSha256` varchar(64) NOT NULL,
	`postTiaSha256` varchar(64) NOT NULL,
	`workbookSha256` varchar(64) NOT NULL,
	`baselineActivityCount` int NOT NULL,
	`postTiaActivityCount` int NOT NULL,
	`baselineRelationshipCount` int NOT NULL,
	`postTiaRelationshipCount` int NOT NULL,
	`localCpmDurationDeltaDays` int NOT NULL,
	`status` enum('locally_verified','manual_p6_review_required') NOT NULL DEFAULT 'manual_p6_review_required',
	`limitations` text NOT NULL,
	`sourceFactsJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `training_references_id` PRIMARY KEY(`id`),
	CONSTRAINT `training_references_owner_project_key_uq` UNIQUE(`ownerUserId`,`projectKey`,`referenceKey`)
);
--> statement-breakpoint
ALTER TABLE `training_references` ADD CONSTRAINT `training_references_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `training_references_owner_project_created_idx` ON `training_references` (`ownerUserId`,`projectKey`,`createdAt`);