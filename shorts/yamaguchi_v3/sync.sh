#!/bin/sh
# copy the Remotion project files of the v3 edit from the working project (/home/user/remo) into the repo
R=/home/user/remo
D=$(dirname "$0")/remotion
rm -rf "$D/src/videos/yama3" && mkdir -p "$D/src/videos" "$D/scripts" "$D/public/fonts" && cp -r "$R/src/videos/yama3" "$D/src/videos/yama3"
cp "$R/src/index.ts" "$D/src/"
cp "$R/public/fonts/InterDisplay-Black.otf" "$R/public/fonts/Inter-Bold.otf" "$R/public/fonts/LICENSE-Inter.txt" "$D/public/fonts/"
cp "$R/scripts/stills2.mjs" "$R/scripts/sheet.py" "$R/scripts/render_final.mjs" "$D/scripts/" 2>/dev/null
cp "$R/tsconfig.json" "$D/"
node -e 'const p=require(process.argv[1]);console.log(JSON.stringify({name:"yamaguchi-short-v3",private:true,dependencies:p.dependencies},null,2))' "$R/package.json" > "$D/package.json"
# the repo copy registers only this edit
cat > "$D/src/Root.tsx" <<'TSX'
import React from "react";
import { Composition } from "remotion";
import { YamaShortV3, YAMA3_FRAMES } from "./videos/yama3/Short";

export const RemotionRoot: React.FC = () => (
  <Composition id="YamaShortV3" component={YamaShortV3} durationInFrames={YAMA3_FRAMES} fps={30} width={1080} height={1920} />
);
TSX
