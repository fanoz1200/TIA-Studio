CREATE TABLE `claim_review_participants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`claimReviewId` int NOT NULL,
	`stage` enum('planning_review','contract_review','claims_manager_approval') NOT NULL,
	`reviewerId` int NOT NULL,
	`assignedBy` int NOT NULL,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `claim_review_participants_id` PRIMARY KEY(`id`),
	CONSTRAINT `claim_review_participants_review_stage_uq` UNIQUE(`claimReviewId`,`stage`)
);
--> statement-breakpoint
ALTER TABLE `claim_review_participants` ADD CONSTRAINT `claim_review_participants_claimReviewId_claim_reviews_id_fk` FOREIGN KEY (`claimReviewId`) REFERENCES `claim_reviews`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `claim_review_participants` ADD CONSTRAINT `claim_review_participants_reviewerId_users_id_fk` FOREIGN KEY (`reviewerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `claim_review_participants` ADD CONSTRAINT `claim_review_participants_assignedBy_users_id_fk` FOREIGN KEY (`assignedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `claim_review_participants_reviewer_stage_idx` ON `claim_review_participants` (`reviewerId`,`stage`);