# No user scoping on domain entities (deliberate)

Meridiano is currently single-user — the only operator is the owner. Briefings, bookmarks, and articles carry no `userId` foreign key by design, not by omission. Multi-user support is planned but deliberately deferred until the domain model is stable. When multi-tenancy is introduced, adding `userId` will require schema migrations across several tables — agents and reviewers should not "fix" the missing user relationship in the meantime.
