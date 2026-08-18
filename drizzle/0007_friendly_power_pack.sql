DROP INDEX `concurrent_delay_records_owner_project_claim_idx` ON `concurrent_delay_records`;--> statement-breakpoint
ALTER TABLE `concurrent_delay_records` ADD `analysisWindowKey` varchar(128) NOT NULL DEFAULT 'LEGACY_WINDOW_UNMAPPED';--> statement-breakpoint
CREATE INDEX `concurrent_delay_records_owner_project_claim_window_idx` ON `concurrent_delay_records` (`ownerUserId`,`projectKey`,`claimChainId`,`analysisWindowKey`);
