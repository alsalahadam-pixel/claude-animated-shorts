import React from "react";
import { Composition } from "remotion";
import { YamaShortV3, YAMA3_FRAMES } from "./videos/yama3/Short";

export const RemotionRoot: React.FC = () => (
  <Composition id="YamaShortV3" component={YamaShortV3} durationInFrames={YAMA3_FRAMES} fps={30} width={1080} height={1920} />
);
