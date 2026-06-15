---
change_id: wz-photos-supabase-storage
title: WZ delivery-note photo upload via Supabase Storage
status: implementing
created: 2026-06-16
updated: 2026-06-16
archived_at: null
---

## Notes

GR-01 goods-receiving shipped without photo upload: the Google Drive route was a
dead-end (the service account has no storage quota). WZ delivery-note photos were
deferred to Supabase Storage, hidden behind a `WZ_PHOTOS_ENABLED` flag. This change
implements that deferred path — uploading WZ photos to Supabase Storage instead of Drive.

Dedicated worktree: `.claude/worktrees/wz-photos-supabase-storage` on branch
`claude/wz-photos-supabase-storage` (branched from origin/main).
