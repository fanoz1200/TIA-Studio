CREATE TABLE `claim_chains` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`projectKey` varchar(128) NOT NULL,
	`claimKey` varchar(128) NOT NULL,
	`parentClaimId` int,
	`title` varchar(255) NOT NULL,
	`periodStart` timestamp,
	`periodEnd` timestamp,
	`methodology` varchar(160) NOT NULL DEFAULT 'TIA / AACE RP 29R-03 / SCL Protocol',
	`status` enum('draft','under_review','ready_to_export','closed') NOT NULL DEFAULT 'draft',
	`unifiedNarrative` text NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `claim_chains_id` PRIMARY KEY(`id`),
	CONSTRAINT `claim_chains_owner_project_key_uq` UNIQUE(`ownerUserId`,`projectKey`,`claimKey`)
);
--> statement-breakpoint
CREATE TABLE `concurrent_delay_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`projectKey` varchar(128) NOT NULL,
	`claimChainId` int NOT NULL,
	`primaryEventKey` varchar(128) NOT NULL,
	`concurrentEventKey` varchar(128) NOT NULL,
	`overlapStart` timestamp NOT NULL,
	`overlapEnd` timestamp NOT NULL,
	`responsibility` enum('employer','contractor','neutral','mixed','undetermined') NOT NULL DEFAULT 'undetermined',
	`treatment` enum('unresolved','separate','absorbed','apportioned') NOT NULL DEFAULT 'unresolved',
	`notes` text NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `concurrent_delay_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `claim_chains` ADD CONSTRAINT `claim_chains_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `claim_chains` ADD CONSTRAINT `claim_chains_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `concurrent_delay_records` ADD CONSTRAINT `concurrent_delay_records_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `concurrent_delay_records` ADD CONSTRAINT `concurrent_delay_records_claimChainId_claim_chains_id_fk` FOREIGN KEY (`claimChainId`) REFERENCES `claim_chains`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `concurrent_delay_records` ADD CONSTRAINT `concurrent_delay_records_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `claim_chains_owner_project_created_idx` ON `claim_chains` (`ownerUserId`,`projectKey`,`createdAt`);--> statement-breakpoint
CREATE INDEX `claim_chains_parent_idx` ON `claim_chains` (`parentClaimId`);--> statement-breakpoint
CREATE INDEX `concurrent_delay_records_owner_project_claim_idx` ON `concurrent_delay_records` (`ownerUserId`,`projectKey`,`claimChainId`);