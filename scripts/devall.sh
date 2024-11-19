echo "Passing arguments: $* --character=\"characters/fusion.character.json\""
npx concurrently --raw \
  "pnpm --dir packages/core dev -- $* --character=\"characters/fusion.character.json\"" \
  "pnpm --dir packages/client-telegram dev -- $* --character=\"characters/fusion.character.json\"" \
  "pnpm --dir packages/client-discord dev -- $* --character=\"characters/fusion.character.json\"" \
  "pnpm --dir packages/client-twitter dev -- $* --character=\"characters/fusion.character.json\"" \
  "pnpm --dir packages/client-ui dev -- $* --character=\"characters/fusion.character.json\"" \
  "pnpm --dir packages/plugin-bootstrap dev -- $* --character=\"characters/fusion.character.json\"" \
  "pnpm --dir packages/plugin-node dev -- $* --character=\"characters/fusion.character.json\"" \
  "pnpm --dir packages/adapter-sqlite dev -- $* --character=\"characters/fusion.character.json\"" \
  "pnpm --dir packages/adapter-postgres dev -- $* --character=\"characters/fusion.character.json\"" \
  "node -e \"setTimeout(() => process.exit(0), 5000)\" && pnpm --dir packages/agent dev -- $* --characters=\"characters/fusion.character.json,characters/shannonai.character.json\""