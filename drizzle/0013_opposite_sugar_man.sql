ALTER TABLE `project_invitations` ADD `accessDurationDays` int DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE `project_members` ADD `accessExpiresAt` timestamp;