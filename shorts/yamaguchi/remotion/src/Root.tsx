import React from "react";
import { Composition } from "remotion";
import { YamaShort, YAMA_FRAMES } from "./videos/yama/Short";

export const RemotionRoot: React.FC = () => (
  <Composition id="YamaShort" component={YamaShort} durationInFrames={YAMA_FRAMES} fps={30} width={1080} height={1920} />
);
