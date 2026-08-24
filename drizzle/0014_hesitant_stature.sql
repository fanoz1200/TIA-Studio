CREATE TABLE `claim_candidates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`projectKey` varchar(128) NOT NULL,
	`candidateKey` varchar(128) NOT NULL,
	`title` varchar(255) NOT NULL,
	`riskId` int,
	`plannerIssueLogId` int,
	`claimChainId` int,
	`contractClauseReference` varchar(255),
	`basisSummary` text NOT NULL,
	`sourceReference` text,
	`sourceStatus` enum('sourced','to_enrich','review_required','rejected') NOT NULL DEFAULT 'to_enrich',
	`status` enum('draft','under_review','ready_for_notice','linked_to_claim','closed') NOT NULL DEFAULT 'draft',
	`reviewNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `claim_candidates_id` PRIMARY KEY(`id`),
	CONSTRAINT `claim_candidates_owner_project_key_uq` UNIQUE(`ownerUserId`,`projectKey`,`candidateKey`)
);
--> statement-breakpoint
CREATE TABLE `claim_deadline_trackers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`projectKey` varchar(128) NOT NULL,
	`claimCandidateId` int NOT NULL,
	`deadlineKey` varchar(128) NOT NULL,
	`title` varchar(255) NOT NULL,
	`deadlineKind` enum('notice','particulars','substantiation','other') NOT NULL DEFAULT 'notice',
	`calculationMode` enum('manual_date','calendar_days') NOT NULL DEFAULT 'manual_date',
	`referenceDate` timestamp,
	`calendarDays` int,
	`dueDate` timestamp,
	`ruleDescription` text NOT NULL,
	`sourceReference` text,
	`sourceStatus` enum('sourced','to_enrich','review_required','rejected') NOT NULL DEFAULT 'to_enrich',
	`status` enum('unconfigured','tracking','review_required','completed','superseded') NOT NULL DEFAULT 'unconfigured',
	`reviewNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `claim_deadline_trackers_id` PRIMARY KEY(`id`),
	CONSTRAINT `claim_deadline_trackers_candidate_key_uq` UNIQUE(`claimCandidateId`,`deadlineKey`)
);
--> statement-breakpoint
CREATE TABLE `claim_risks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`projectKey` varchar(128) NOT NULL,
	`riskKey` varchar(128) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`identifiedDate` timestamp,
	`ownerRole` varchar(120),
	`sourceReference` text,
	`sourceStatus` enum('sourced','to_enrich','review_required','rejected') NOT NULL DEFAULT 'to_enrich',
	`status` enum('open','monitoring','escalated','closed') NOT NULL DEFAULT 'open',
	`linkedPlannerIssueId` int,
	`reviewNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `claim_risks_id` PRIMARY KEY(`id`),
	CONSTRAINT `claim_risks_owner_project_key_uq` UNIQUE(`ownerUserId`,`projectKey`,`riskKey`)
);
--> statement-breakpoint
CREATE TABLE `project_contract_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`projectKey` varchar(128) NOT NULL,
	`contractTitle` varchar(255),
	`contractForm` varchar(255),
	`contractEdition` varchar(160),
	`specialConditionsReference` varchar(255),
	`governingLaw` varchar(255),
	`claimClauseReference` varchar(255),
	`noticeTriggerDescription` text,
	`sourceReference` text,
	`sourceStatus` enum('sourced','to_enrich','review_required','rejected') NOT NULL DEFAULT 'to_enrich',
	`reviewNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_contract_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_contract_profiles_owner_project_uq` UNIQUE(`ownerUserId`,`projectKey`)
);
--> statement-breakpoint
ALTER TABLE `claim_candidates` ADD CONSTRAINT `claim_candidates_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `claim_candidates` ADD CONSTRAINT `claim_candidates_riskId_claim_risks_id_fk` FOREIGN KEY (`riskId`) REFERENCES `claim_risks`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `claim_candidates` ADD CONSTRAINT `claim_candidates_plannerIssueLogId_planner_issue_logs_id_fk` FOREIGN KEY (`plannerIssueLogId`) REFERENCES `planner_issue_logs`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `claim_candidates` ADD CONSTRAINT `claim_candidates_claimChainId_claim_chains_id_fk` FOREIGN KEY (`claimChainId`) REFERENCES `claim_chains`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `claim_deadline_trackers` ADD CONSTRAINT `claim_deadline_trackers_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `claim_deadline_trackers` ADD CONSTRAINT `claim_deadline_trackers_claimCandidateId_claim_candidates_id_fk` FOREIGN KEY (`claimCandidateId`) REFERENCES `claim_candidates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `claim_risks` ADD CONSTRAINT `claim_risks_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `claim_risks` ADD CONSTRAINT `claim_risks_linkedPlannerIssueId_planner_issue_logs_id_fk` FOREIGN KEY (`linkedPlannerIssueId`) REFERENCES `planner_issue_logs`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_contract_profiles` ADD CONSTRAINT `project_contract_profiles_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `claim_candidates_owner_project_status_idx` ON `claim_candidates` (`ownerUserId`,`projectKey`,`status`);--> statement-breakpoint
CREATE INDEX `claim_deadline_trackers_owner_project_due_idx` ON `claim_deadline_trackers` (`ownerUserId`,`projectKey`,`dueDate`);--> statement-breakpoint
CREATE INDEX `claim_risks_owner_project_status_idx` ON `claim_risks` (`ownerUserId`,`projectKey`,`status`);