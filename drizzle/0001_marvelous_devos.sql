PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY DEFAULT (hex(randomblob(16))) NOT NULL,
	`username` text NOT NULL,
	`password` text,
	`google_id` text,
	`email` text,
	`display_name` text,
	`avatar_url` text,
	`auth_provider` text DEFAULT 'local' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	`last_login` integer
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "username", "password", "google_id", "email", "display_name", "avatar_url", "auth_provider", "created_at", "updated_at", "last_login") SELECT "id", "username", "password", "google_id", "email", "display_name", "avatar_url", "auth_provider", "created_at", "updated_at", "last_login" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_id_unique` ON `users` (`google_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);