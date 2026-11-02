import React from "react";
import { Composition } from "remotion";
import { Test } from "./Test";
import { CharSheet } from "./CharSheet";
import { LastHuman, LAST_HUMAN_FRAMES, Photo } from "./LastHuman";

export const Root: React.FC = () => (
  <>
    <Composition id="LastHuman" component={LastHuman} durationInFrames={LAST_HUMAN_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Photo" component={Photo} durationInFrames={1} fps={30} width={1080} height={1440} />
    <Composition id="Test" component={Test} durationInFrames={60} fps={30} width={1080} height={1920} />
    <Composition id="CharSheet" component={CharSheet} durationInFrames={1} fps={30} width={1080} height={1920} />
  </>
);
