# hoopsKills

## Glossary

Every glossary term lives in `stat_explorer/src/constants/glossaryEntries.js` (grouped in `GLOSSARY_GROUPS`). The per-page floating `<Glossary>` (Box, Kills) and the hidden `/glossary` page both render from it. When you add a glossary term anywhere, add it to that file (in the right group, or a new group) so it shows up on `/glossary`. Don't write entries inline in a view.
