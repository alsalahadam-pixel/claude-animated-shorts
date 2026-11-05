import React from "react";
import { Composition } from "remotion";
import { Test } from "./Test";
import { CharSheet } from "./CharSheet";
import { CharRef } from "./CharRef";
import { LastHuman, LAST_HUMAN_FRAMES, Photo } from "./LastHuman";

export const Root: React.FC = () => (
  <>
    <Composition id="LastHuman" component={LastHuman} durationInFrames={LAST_HUMAN_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Photo" component={Photo} durationInFrames={1} fps={30} width={1080} height={1440} />
    <Composition id="Test" component={Test} durationInFrames={60} fps={30} width={1080} height={1920} />
    <Composition id="CharRef" component={CharRef} durationInFrames={1} fps={30} width={2160} height={2700} defaultProps={{ part: "hero" as const }} />
    <Composition id="EntityRef" component={CharRef} durationInFrames={1} fps={30} width={2160} height={2700} defaultProps={{ part: "entity" as const }} />
    <Composition id="SleeperRef" component={CharRef} durationInFrames={1} fps={30} width={2160} height={2700} defaultProps={{ part: "sleeper" as const }} />
    <Composition id="CharSheet" component={CharSheet} durationInFrames={1} fps={30} width={1080} height={1920} />
  </>
);
