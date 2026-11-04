import React from "react";
import { Composition } from "remotion";
import { YamaShortV2, YAMA2_FRAMES } from "./videos/yama2/Short";

export const RemotionRoot: React.FC = () => (
  <Composition id="YamaShortV2" component={YamaShortV2} durationInFrames={YAMA2_FRAMES} fps={30} width={1080} height={1920} />
);
