#!/bin/sh
# copy the Remotion project files of this short from the working project (/home/user/remo) into the repo
R=/home/user/remo
D=$(dirname "$0")/remotion
rm -rf "$D/src/videos/yama" && cp -r "$R/src/videos/yama" "$D/src/videos/yama"
cp "$R/src/index.ts" "$R/src/Root.tsx" "$D/src/"
cp "$R/scripts/stills2.mjs" "$R/scripts/sheet.py" "$R/scripts/profile.mjs" "$D/scripts/" 2>/dev/null
cp "$R/tsconfig.json" "$D/"
node -e 'const p=require(process.argv[1]);console.log(JSON.stringify({name:"yamaguchi-short",private:true,dependencies:p.dependencies},null,2))' "$R/package.json" > "$D/package.json"
# the repo copy registers only this short
cat > "$D/src/Root.tsx" <<'TSX'
import React from "react";
import { Composition } from "remotion";
import { YamaShort, YAMA_FRAMES } from "./videos/yama/Short";

export const RemotionRoot: React.FC = () => (
  <Composition id="YamaShort" component={YamaShort} durationInFrames={YAMA_FRAMES} fps={30} width={1080} height={1920} />
);
TSX
