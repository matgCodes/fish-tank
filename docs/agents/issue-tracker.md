# Issue tracker: GitHub Issues

Issues for this repo live in GitHub Issues on `matgCodes/fish-tank`. Use the
`gh` CLI. Pass bodies with `--body-file`.

## Wayfinding operations

- **Map:** the single issue labelled `wayfinder:map`.
- **Tickets:** GitHub sub-issues of the map. Each carries one label of
  `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`,
  `wayfinder:task`.
- **Claim:** assign the ticket to yourself before any work. An open,
  unassigned ticket is unclaimed.
- **Blocking:** GitHub's native issue dependencies ("blocked by"). If the
  dependency API is unavailable, a `Blocked by:` line at the top of the ticket
  body is the fallback.
- **Frontier:** open sub-issues of the map that are unassigned and have no
  open blockers.
- **Resolve:** post the answer as a comment, close the issue, append one
  linked-name line to the map's "Decisions so far".

## Execution override

This map carries execution, not only decisions. The build ends the same day
it started, so build slices are `wayfinder:task` tickets on the same board as
the decisions.
