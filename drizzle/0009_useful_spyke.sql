CREATE TABLE `planner_issue_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`projectKey` varchar(128) NOT NULL,
	`issueNo` varchar(128) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`occurrenceDate` timestamp NOT NULL,
	`reportedBy` varchar(255),
	`responsibleParty` enum('employer','contractor','engineer','third_party','undetermined') NOT NULL DEFAULT 'undetermined',
	`delayCause` enum('employer','contractor','neutral') NOT NULL DEFAULT 'neutral',
	`affectedActivityIds` text NOT NULL,
	`replacedRelationshipId` varchar(128) NOT NULL,
	`proposedDurationDays` decimal(12,2) NOT NULL,
	`criticality` enum('unknown','potentially_critical','critical','noncritical') NOT NULL DEFAULT 'unknown',
	`status` enum('open','ready_for_fragnet','applied','rejected','closed') NOT NULL DEFAULT 'open',
	`fragnetProposalJson` text NOT NULL,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`appliedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `planner_issue_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `planner_issue_logs_owner_project_issue_uq` UNIQUE(`ownerUserId`,`projectKey`,`issueNo`)
);
--> statement-breakpoint
ALTER TABLE `planner_issue_logs` ADD CONSTRAINT `planner_issue_logs_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `planner_issue_logs` ADD CONSTRAINT `planner_issue_logs_reviewedBy_users_id_fk` FOREIGN KEY (`reviewedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `planner_issue_logs_owner_project_status_idx` ON `planner_issue_logs` (`ownerUserId`,`projectKey`,`status`);--> statement-breakpoint
CREATE INDEX `planner_issue_logs_owner_project_date_idx` ON `planner_issue_logs` (`ownerUserId`,`projectKey`,`occurrenceDate`);