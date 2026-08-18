CREATE TABLE `claim_review_stages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`claimReviewId` int NOT NULL,
	`stage` enum('draft','planning_review','contract_review','claims_manager_approval','ready_to_export','rejected') NOT NULL,
	`reviewerId` int NOT NULL,
	`decision` enum('created','submitted','approved','rejected','commented','reopened') NOT NULL,
	`comment` text,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `claim_review_stages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `claim_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectKey` varchar(128) NOT NULL,
	`claimKey` varchar(128) NOT NULL,
	`claimTitle` varchar(255) NOT NULL,
	`currentStage` enum('draft','planning_review','contract_review','claims_manager_approval','ready_to_export','rejected') NOT NULL DEFAULT 'draft',
	`status` enum('draft','in_review','approved','rejected','ready_to_export') NOT NULL DEFAULT 'draft',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `claim_reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `claim_reviews_user_project_claim_uq` UNIQUE(`userId`,`projectKey`,`claimKey`)
);
--> statement-breakpoint
CREATE TABLE `notice_register` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectKey` varchar(128) NOT NULL,
	`claimKey` varchar(128) NOT NULL,
	`eventKey` varchar(128) NOT NULL,
	`noticeNo` varchar(128) NOT NULL,
	`sender` varchar(255),
	`recipient` varchar(255),
	`contractClause` varchar(255),
	`awarenessDate` timestamp,
	`noticeDueDate` timestamp,
	`sentDate` timestamp,
	`status` enum('draft','under_review','sent','overdue','cancelled') NOT NULL DEFAULT 'draft',
	`narrative` text NOT NULL,
	`timeImpactDays` decimal(12,2) NOT NULL DEFAULT '0',
	`costImpact` decimal(18,4) NOT NULL DEFAULT '0',
	`evidenceReferenceIds` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notice_register_id` PRIMARY KEY(`id`),
	CONSTRAINT `notice_register_user_project_notice_uq` UNIQUE(`userId`,`projectKey`,`noticeNo`)
);
--> statement-breakpoint
CREATE TABLE `resource_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectKey` varchar(128) NOT NULL,
	`activityId` varchar(128) NOT NULL,
	`assignmentKey` varchar(160) NOT NULL,
	`resourceId` varchar(128),
	`resourceName` varchar(255),
	`resourceType` enum('labor','nonlabor','material','unknown') NOT NULL DEFAULT 'unknown',
	`costAccountId` varchar(128),
	`wbsId` varchar(128),
	`targetQuantity` decimal(18,4) NOT NULL DEFAULT '0',
	`remainingQuantity` decimal(18,4) NOT NULL DEFAULT '0',
	`actualRegularQuantity` decimal(18,4) NOT NULL DEFAULT '0',
	`actualOvertimeQuantity` decimal(18,4) NOT NULL DEFAULT '0',
	`targetCost` decimal(18,4) NOT NULL DEFAULT '0',
	`remainingCost` decimal(18,4) NOT NULL DEFAULT '0',
	`actualRegularCost` decimal(18,4) NOT NULL DEFAULT '0',
	`actualOvertimeCost` decimal(18,4) NOT NULL DEFAULT '0',
	`costPerUnit` decimal(18,4) NOT NULL DEFAULT '0',
	`sourceFormat` enum('xer','p6_xml','manual') NOT NULL,
	`importedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `resource_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `resource_assignments_user_project_assignment_uq` UNIQUE(`userId`,`projectKey`,`assignmentKey`)
);
--> statement-breakpoint
ALTER TABLE `claim_review_stages` ADD CONSTRAINT `claim_review_stages_claimReviewId_claim_reviews_id_fk` FOREIGN KEY (`claimReviewId`) REFERENCES `claim_reviews`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `claim_review_stages` ADD CONSTRAINT `claim_review_stages_reviewerId_users_id_fk` FOREIGN KEY (`reviewerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `claim_reviews` ADD CONSTRAINT `claim_reviews_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `claim_reviews` ADD CONSTRAINT `claim_reviews_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notice_register` ADD CONSTRAINT `notice_register_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `resource_assignments` ADD CONSTRAINT `resource_assignments_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `claim_review_stages_claim_recorded_idx` ON `claim_review_stages` (`claimReviewId`,`recordedAt`);--> statement-breakpoint
CREATE INDEX `notice_register_user_project_event_idx` ON `notice_register` (`userId`,`projectKey`,`eventKey`);--> statement-breakpoint
CREATE INDEX `resource_assignments_user_project_activity_idx` ON `resource_assignments` (`userId`,`projectKey`,`activityId`);